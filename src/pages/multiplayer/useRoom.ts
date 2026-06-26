// src/pages/multiplayer/useRoom.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type {
  GameRoomRow,
  RoomPlayerProfile,
  RoomMessageEnriched,
  RealtimeBroadcastEvent,
  TeamChoice,
} from './multiplayerTypes'

interface UseRoomReturn {
  room: GameRoomRow | null
  players: RoomPlayerProfile[]
  messages: RoomMessageEnriched[]
  loading: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  updateMyTeam: (team: TeamChoice) => Promise<void>
  startCountdown: () => Promise<void>
  leaveRoom: () => Promise<void>
  broadcast: (event: RealtimeBroadcastEvent) => void
  countdownServerTs: string | null
}

// ─── Helper: re-fetch the full player list for a room ─────────────────────────
async function fetchPlayerList(roomId: string): Promise<RoomPlayerProfile[]> {
  const { data } = await supabase
    .from('room_players')
    .select(`
      player_id, team, is_host, joined_at,
      profiles:player_id ( username, display_name, avatar )
    `)
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })

  if (!data) return []

  return data.map((row: Record<string, unknown>) => {
    const profile = row.profiles as { username: string; display_name: string | null; avatar: string } | null
    return {
      player_id:    row.player_id as string,
      username:     profile?.username ?? 'Player',
      display_name: profile?.display_name ?? null,
      avatar:       profile?.avatar ?? '',
      team:         row.team as TeamChoice,
      is_host:      row.is_host as boolean,
      joined_at:    row.joined_at as string,
    }
  })
}

export function useRoom(roomId: string, myId: string): UseRoomReturn {
  const [room,              setRoom]              = useState<GameRoomRow | null>(null)
  const [players,           setPlayers]           = useState<RoomPlayerProfile[]>([])
  const [messages,          setMessages]          = useState<RoomMessageEnriched[]>([])
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState<string | null>(null)
  const [countdownServerTs, setCountdownServerTs] = useState<string | null>(null)

  const channelRef  = useRef<RealtimeChannel | null>(null)
  const roomRef     = useRef<GameRoomRow | null>(null)
  const playersRef  = useRef<RoomPlayerProfile[]>([])
  // isHostRef is derived from the players list — never set independently
  const isHostRef   = useRef(false)

  // Keep refs in sync with state
  useEffect(() => { roomRef.current    = room    }, [room])
  useEffect(() => { playersRef.current = players }, [players])

  // ── Helper: apply a new players list to both state and refs ─────────────────
  const applyPlayers = useCallback((list: RoomPlayerProfile[]) => {
    setPlayers(list)
    playersRef.current = list
    isHostRef.current  = list.find(p => p.player_id === myId)?.is_host ?? false
  }, [myId])

  // ── loadMessages ─────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    const { data: msgData } = await supabase
      .from('room_messages')
      .select(`
        id, room_id, player_id, message, created_at,
        profiles:player_id ( username, display_name )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (msgData) {
      const mapped: RoomMessageEnriched[] = msgData.map((row: Record<string, unknown>) => {
        const profile = row.profiles as { username: string; display_name: string | null } | null
        const name = profile?.display_name || profile?.username || 'Player'
        return {
          id:          row.id as string,
          room_id:     row.room_id as string,
          player_id:   row.player_id as string,
          message:     row.message as string,
          created_at:  row.created_at as string,
          senderName:  name,
          senderAvatar: name.charAt(0).toUpperCase(),
        }
      })
      setMessages(mapped)
    }
  }, [roomId])

  // ── loadRoom: initial fetch ──────────────────────────────────────────────────
  const loadRoom = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: roomData, error: roomErr } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (roomErr || !roomData) {
      setError(roomErr?.message ?? 'Room not found')
      setLoading(false)
      return
    }

    setRoom(roomData as GameRoomRow)
    roomRef.current = roomData as GameRoomRow

    const list = await fetchPlayerList(roomId)
    applyPlayers(list)

    await loadMessages()
    setLoading(false)
  }, [roomId, applyPlayers, loadMessages])

  // ── startCountdown ───────────────────────────────────────────────────────────
  const startCountdown = useCallback(async () => {
    const ts = new Date().toISOString()

    const { data } = await supabase
      .from('game_rooms')
      .update({ status: 'countdown', countdown_start_at: ts })
      .eq('id', roomId)
      .eq('status', 'waiting')  // idempotency guard — only flip once
      .select('countdown_start_at')
      .single()

    if (!data?.countdown_start_at) return

    // Low-latency broadcast for clients on slow Postgres Changes delivery
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'countdown_start',
        serverTimestamp: data.countdown_start_at,
        roomId,
      },
    })
  }, [roomId])

  const startCountdownRef = useRef(startCountdown)
  useEffect(() => { startCountdownRef.current = startCountdown }, [startCountdown])

  // ── Auto-transition to in_progress after 5-second countdown ─────────────────
  useEffect(() => {
    if (!countdownServerTs) return

    const elapsed   = Date.now() - new Date(countdownServerTs).getTime()
    const remaining = Math.max(0, 5000 - elapsed)

    const timer = setTimeout(async () => {
      if (isHostRef.current) {
        await supabase
          .from('game_rooms')
          .update({ status: 'in_progress' })
          .eq('id', roomId)
          .eq('status', 'countdown')  // idempotency guard
      }
    }, remaining)

    return () => clearTimeout(timer)
  }, [countdownServerTs, roomId])

  // ── Host transfer ────────────────────────────────────────────────────────────
  // Called when the current host's row is deleted (they left or disconnected).
  // The oldest remaining player (by joined_at) becomes the new host.
  async function transferHostIfNeeded(afterDeletion: RoomPlayerProfile[]) {
    if (afterDeletion.length === 0) return

    const newHost = afterDeletion[0] // already sorted by joined_at asc
    if (newHost.is_host) return      // already a host, nothing to do

    // Only the new host's own client should write this — prevents N simultaneous writes
    if (newHost.player_id !== myId) return

    await supabase
      .from('room_players')
      .update({ is_host: true })
      .eq('room_id', roomId)
      .eq('player_id', newHost.player_id)

    // Re-fetch to pick up the updated is_host flag
    const refreshed = await fetchPlayerList(roomId)
    applyPlayers(refreshed)
  }

  // ── Supabase Realtime setup ──────────────────────────────────────────────────
  useEffect(() => {
    loadRoom()

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: true } },
    })

    // Room row updates (status, countdown_start_at, etc.)
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        const updated = payload.new as GameRoomRow
        setRoom(updated)
        roomRef.current = updated
        if (updated.countdown_start_at) {
          setCountdownServerTs(updated.countdown_start_at)
        }
      }
    )

    // Player joins — full re-fetch to get profile data
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      async () => {
        const list = await fetchPlayerList(roomId)
        applyPlayers(list)

        // Auto-start when room fills
        const currentRoom = roomRef.current
        if (
          currentRoom &&
          list.length >= currentRoom.max_player_count &&
          currentRoom.status === 'waiting' &&
          isHostRef.current
        ) {
          startCountdownRef.current()
        }
      }
    )

    // Player leaves — optimistic local filter, then host transfer check
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      async (payload) => {
        const gone = (payload.old as { player_id: string }).player_id

        // Build the updated list from the current ref (don't wait for a re-fetch)
        const afterDeletion = playersRef.current.filter(p => p.player_id !== gone)
        applyPlayers(afterDeletion)

        // Check if the player who left was the host
        const wasHost = playersRef.current.find(p => p.player_id === gone)?.is_host ?? false
        if (wasHost && afterDeletion.length > 0) {
          await transferHostIfNeeded(afterDeletion)
        }
      }
    )

    // Broadcast events (team changes, chat, countdown)
    channel.on('broadcast', { event: 'room_event' }, ({ payload }) => {
      const ev = payload as RealtimeBroadcastEvent

      if (ev.type === 'team_change') {
        setPlayers(prev =>
          prev.map(p => p.player_id === ev.playerId ? { ...p, team: ev.team } : p)
        )
      }

      if (ev.type === 'countdown_start') {
        // Only write if DB Postgres Changes hasn't already set this (guard with prev)
        setCountdownServerTs(prev => prev ?? ev.serverTimestamp)
      }

      if (ev.type === 'chat_message') {
        setMessages(prev => [
          ...prev,
          {
            id:          ev.id,
            room_id:     roomId,
            player_id:   ev.playerId,
            message:     ev.message,
            created_at:  ev.createdAt,
            senderName:  ev.senderName,
            senderAvatar: ev.senderName.charAt(0).toUpperCase(),
          },
        ])
      }
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myId])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const { data, error: sendErr } = await supabase
      .from('room_messages')
      .insert({ room_id: roomId, player_id: myId, message: trimmed })
      .select('id, created_at')
      .single()

    if (sendErr || !data) return

    const me = playersRef.current.find(p => p.player_id === myId)
    const senderName = me?.display_name || me?.username || 'Player'

    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type:       'chat_message',
        id:         data.id,
        playerId:   myId,
        senderName,
        message:    trimmed,
        createdAt:  data.created_at,
      } as RealtimeBroadcastEvent,
    })
  }, [roomId, myId])

  const updateMyTeam = useCallback(async (team: TeamChoice) => {
    await supabase
      .from('room_players')
      .update({ team })
      .eq('room_id', roomId)
      .eq('player_id', myId)

    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'team_change', playerId: myId, team },
    })
  }, [roomId, myId])

  const leaveRoom = useCallback(async () => {
    // Prevent mid-game abandonment
    if (
      roomRef.current?.status === 'countdown' ||
      roomRef.current?.status === 'in_progress'
    ) return

    await supabase
      .from('room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('player_id', myId)

    await channelRef.current?.unsubscribe()
  }, [roomId, myId])

  const broadcast = useCallback((event: RealtimeBroadcastEvent) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: event,
    })
  }, [])

  return {
    room,
    players,
    messages,
    loading,
    error,
    sendMessage,
    updateMyTeam,
    startCountdown,
    leaveRoom,
    broadcast,
    countdownServerTs,
  }
}
