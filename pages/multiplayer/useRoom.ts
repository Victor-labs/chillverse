// src/pages/multiplayer/useRoom.ts
// Supabase Realtime hook — room state, player presence, chat, broadcast events

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

export function useRoom(roomId: string, myId: string): UseRoomReturn {
  const [room, setRoom] = useState<GameRoomRow | null>(null)
  const [players, setPlayers] = useState<RoomPlayerProfile[]>([])
  const [messages, setMessages] = useState<RoomMessageEnriched[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [countdownServerTs, setCountdownServerTs] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)

  // ── Fetch initial room + players + message history ──────────
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

    // Load players with profile join
    const { data: playersData } = await supabase
      .from('room_players')
      .select(`
        player_id,
        team,
        is_host,
        joined_at,
        profiles:player_id (
          username,
          display_name,
          avatar
        )
      `)
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    if (playersData) {
      const mapped: RoomPlayerProfile[] = playersData.map((row: Record<string, unknown>) => {
        const profile = row.profiles as { username: string; display_name: string | null; avatar: string } | null
        return {
          player_id: row.player_id as string,
          username: profile?.username ?? 'Player',
          display_name: profile?.display_name ?? null,
          avatar: profile?.avatar ?? '',
          team: row.team as TeamChoice,
          is_host: row.is_host as boolean,
          joined_at: row.joined_at as string,
        }
      })
      setPlayers(mapped)
    }

    // Load message history
    await loadMessages()

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const loadMessages = useCallback(async () => {
    const { data: msgData } = await supabase
      .from('room_messages')
      .select(`
        id,
        room_id,
        player_id,
        message,
        created_at,
        profiles:player_id (
          username,
          display_name
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (msgData) {
      const mapped: RoomMessageEnriched[] = msgData.map((row: Record<string, unknown>) => {
        const profile = row.profiles as { username: string; display_name: string | null } | null
        const name = profile?.display_name || profile?.username || 'Player'
        return {
          id: row.id as string,
          room_id: row.room_id as string,
          player_id: row.player_id as string,
          message: row.message as string,
          created_at: row.created_at as string,
          senderName: name,
          senderAvatar: name.charAt(0).toUpperCase(),
        }
      })
      setMessages(mapped)
    }
  }, [roomId])

  // ── Supabase Realtime setup ──────────────────────────────────
  useEffect(() => {
    loadRoom()

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: true } },
    })

    // Postgres Changes — room status updates
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        setRoom(payload.new as GameRoomRow)
        if ((payload.new as GameRoomRow).countdown_start_at) {
          setCountdownServerTs((payload.new as GameRoomRow).countdown_start_at)
        }
      }
    )

    // Postgres Changes — player joins
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      async () => {
        // Re-fetch players list to get full profile data
        const { data } = await supabase
          .from('room_players')
          .select(`
            player_id, team, is_host, joined_at,
            profiles:player_id (username, display_name, avatar)
          `)
          .eq('room_id', roomId)
          .order('joined_at', { ascending: true })

        if (data) {
          setPlayers(
            data.map((row: Record<string, unknown>) => {
              const profile = row.profiles as { username: string; display_name: string | null; avatar: string } | null
              return {
                player_id: row.player_id as string,
                username: profile?.username ?? 'Player',
                display_name: profile?.display_name ?? null,
                avatar: profile?.avatar ?? '',
                team: row.team as TeamChoice,
                is_host: row.is_host as boolean,
                joined_at: row.joined_at as string,
              }
            })
          )
        }
      }
    )

    // Postgres Changes — player leaves
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const gone = (payload.old as { player_id: string }).player_id
        setPlayers(prev => prev.filter(p => p.player_id !== gone))
      }
    )

    // Broadcast — team changes, game state, etc.
    channel.on('broadcast', { event: 'room_event' }, ({ payload }) => {
      const ev = payload as RealtimeBroadcastEvent
      if (ev.type === 'team_change') {
        setPlayers(prev =>
          prev.map(p =>
            p.player_id === ev.playerId ? { ...p, team: ev.team } : p
          )
        )
      }
      if (ev.type === 'countdown_start') {
        setCountdownServerTs(ev.serverTimestamp)
      }
      if (ev.type === 'chat_message') {
        setMessages(prev => [
          ...prev,
          {
            id: ev.id,
            room_id: roomId,
            player_id: ev.playerId,
            message: ev.message,
            created_at: ev.createdAt,
            senderName: ev.senderName,
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
  }, [roomId, loadRoom])

  // ── Actions ──────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      await supabase.from('room_messages').insert({
        room_id: roomId,
        player_id: myId,
        message: text.trim(),
      })
    },
    [roomId, myId]
  )

  const updateMyTeam = useCallback(
    async (team: TeamChoice) => {
      await supabase
        .from('room_players')
        .update({ team })
        .eq('room_id', roomId)
        .eq('player_id', myId)

      // Broadcast immediately for low-latency UI sync
      channelRef.current?.send({
        type: 'broadcast',
        event: 'room_event',
        payload: { type: 'team_change', playerId: myId, team },
      })
    },
    [roomId, myId]
  )

  const startCountdown = useCallback(async () => {
    const serverTimestamp = new Date().toISOString()
    // Update DB status → triggers Postgres Changes for all clients
    await supabase
      .from('game_rooms')
      .update({ status: 'countdown', countdown_start_at: serverTimestamp })
      .eq('id', roomId)

    // Also broadcast directly for lower latency
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'countdown_start',
        serverTimestamp,
        roomId,
      },
    })
  }, [roomId])

  const leaveRoom = useCallback(async () => {
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
