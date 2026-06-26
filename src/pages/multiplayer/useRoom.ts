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
  isHost: boolean
  sendMessage: (text: string) => Promise<void>
  updateMyTeam: (team: TeamChoice) => Promise<void>
  startCountdown: () => Promise<void>
  leaveRoom: () => Promise<void>
  broadcast: (event: RealtimeBroadcastEvent) => void
  countdownServerTs: string | null
}

// ---------------------------------------------------------------
// Fetch the full player list for a room, with profile join
// ---------------------------------------------------------------
async function fetchPlayerList(roomId: string): Promise<RoomPlayerProfile[]> {
  const { data } = await supabase
    .from('room_players')
    .select(`
      player_id, team, is_host, joined_at,
      profiles:player_id ( username, display_name, avatar )
    `)
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })

  if (!data || data.length === 0) return []

  return data.map((row: Record<string, unknown>) => {
    const profile = row.profiles as
      | { username: string; display_name: string | null; avatar: string }
      | null
    return {
      player_id:    row.player_id as string,
      username:     profile?.username     ?? 'Player',
      display_name: profile?.display_name ?? null,
      avatar:       profile?.avatar       ?? '',
      team:         row.team    as TeamChoice,
      is_host:      row.is_host as boolean,
      joined_at:    row.joined_at as string,
    }
  })
}

// ---------------------------------------------------------------
// Retry wrapper — handles Supabase replication lag (100-400 ms)
// after a client-side insert so the initial fetch never returns
// empty when the lobby mounts immediately after CreateRoom.
// ---------------------------------------------------------------
async function fetchPlayerListWithRetry(
  roomId: string,
  expectedMinCount = 1,
  maxAttempts = 5,
): Promise<RoomPlayerProfile[]> {
  let delay = 150
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const list = await fetchPlayerList(roomId)
    if (list.length >= expectedMinCount) return list
    await new Promise(res => setTimeout(res, delay))
    delay = Math.min(delay * 2, 1500)
  }
  return fetchPlayerList(roomId)
}

// ---------------------------------------------------------------
// Update current_player_count to an exact value derived from the
// authoritative room_players table. Call this after any player
// join or leave so the cached count stays in sync.
// ---------------------------------------------------------------
async function syncPlayerCount(roomId: string) {
  const { count } = await supabase
    .from('room_players')
    .select('*', { head: true, count: 'exact' })
    .eq('room_id', roomId)

  if (typeof count === 'number') {
    await supabase
      .from('game_rooms')
      .update({ current_player_count: count })
      .eq('id', roomId)
  }
}

export function useRoom(roomId: string, myId: string): UseRoomReturn {
  const [room,              setRoom]              = useState<GameRoomRow | null>(null)
  const [players,           setPlayers]           = useState<RoomPlayerProfile[]>([])
  const [messages,          setMessages]          = useState<RoomMessageEnriched[]>([])
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState<string | null>(null)
  const [countdownServerTs, setCountdownServerTs] = useState<string | null>(null)
  const [isHost,            setIsHost]            = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const roomRef    = useRef<GameRoomRow | null>(null)
  const playersRef = useRef<RoomPlayerProfile[]>([])
  const isHostRef  = useRef(false)

  // -- Centralised state + ref update ----------------------------------
  const applyPlayers = useCallback((list: RoomPlayerProfile[]) => {
    setPlayers(list)
    playersRef.current = list
    const meIsHost = list.find(p => p.player_id === myId)?.is_host ?? false
    isHostRef.current = meIsHost
    setIsHost(meIsHost)
  }, [myId])

  // Keep roomRef in sync
  useEffect(() => { roomRef.current = room }, [room])

  // -- loadMessages -----------------------------------------------------
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
          id:           row.id as string,
          room_id:      row.room_id as string,
          player_id:    row.player_id as string,
          message:      row.message as string,
          created_at:   row.created_at as string,
          senderName:   name,
          senderAvatar: name.charAt(0).toUpperCase(),
        }
      })
      setMessages(mapped)
    }
  }, [roomId])

  // -- loadRoom ---------------------------------------------------------
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

    // Expect at least 1 player (the host). The retry loop handles the
    // race condition where the host row hasn't replicated yet.
    const list = await fetchPlayerListWithRetry(roomId, 1)
    applyPlayers(list)

    await loadMessages()
    setLoading(false)
  }, [roomId, applyPlayers, loadMessages])

  // -- startCountdown ---------------------------------------------------
  const startCountdown = useCallback(async () => {
    const { data } = await supabase
      .from('game_rooms')
      .update({ status: 'countdown', countdown_start_at: new Date().toISOString() })
      .eq('id', roomId)
      .eq('status', 'waiting') // idempotency guard
      .select('countdown_start_at')
      .single()

    if (!data?.countdown_start_at) return

    channelRef.current?.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type:            'countdown_start',
        serverTimestamp: data.countdown_start_at,
        roomId,
      },
    })
  }, [roomId])

  const startCountdownRef = useRef(startCountdown)
  useEffect(() => { startCountdownRef.current = startCountdown }, [startCountdown])

  // -- Auto-transition: countdown -> in_progress ------------------------
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
          .eq('status', 'countdown') // guard
      }
    }, remaining)

    return () => clearTimeout(timer)
  }, [countdownServerTs, roomId])

  // -- Supabase Realtime ------------------------------------------------
  useEffect(() => {
    loadRoom()

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: true } },
    })

    // Room row updates (status, countdown_start_at)
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        const updated = payload.new as GameRoomRow
        setRoom(updated)
        roomRef.current = updated

        if (updated.status === 'aborted') {
          setError('The host has left. This room has been closed.')
          setLoading(false)
          setCountdownServerTs(null)
          return
        }

        if (updated.countdown_start_at) {
          setCountdownServerTs(updated.countdown_start_at)
        }
      }
    )

    // Room deleted (host left before game started)
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
      () => {
        setRoom(null)
        setError('The host has left. This room has been closed.')
        setLoading(false)
        setPlayers([])
        setCountdownServerTs(null)
      }
    )

    // Player joins — full re-fetch to get profile data
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      async () => {
        const list = await fetchPlayerList(roomId)
        applyPlayers(list)

        // Sync the cached count with ground truth
        await syncPlayerCount(roomId)

        // Auto-start when room fills to capacity (host-only action)
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

    // Player leaves
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      async (payload) => {
        const gone = (payload.old as { player_id: string }).player_id

        // Check if the departed player was host BEFORE mutating the list
        const wasHost = playersRef.current.find(p => p.player_id === gone)?.is_host ?? false
        const afterDeletion = playersRef.current.filter(p => p.player_id !== gone)
        applyPlayers(afterDeletion)

        // Sync the cached count
        await syncPlayerCount(roomId)

        // If the host left and the game hasn't started yet, the room row
        // itself will be deleted by leaveRoom() — the DELETE listener above
        // will handle navigation for remaining players. Nothing extra to do here.

        // If the host left during countdown, abort it for remaining players
        if (wasHost && roomRef.current?.status === 'countdown') {
          setCountdownServerTs(null)
          channelRef.current?.send({
            type: 'broadcast',
            event: 'room_event',
            payload: { type: 'countdown_abort', roomId },
          })
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
        setCountdownServerTs(prev => prev ?? ev.serverTimestamp)
      }
      if (ev.type === 'countdown_abort') {
        setCountdownServerTs(null)
      }
      if (ev.type === 'chat_message') {
        setMessages(prev => [
          ...prev,
          {
            id:           ev.id,
            room_id:      roomId,
            player_id:    ev.playerId,
            message:      ev.message,
            created_at:   ev.createdAt,
            senderName:   ev.senderName,
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

  // -- Actions ----------------------------------------------------------

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
        type:      'chat_message',
        id:        data.id,
        playerId:  myId,
        senderName,
        message:   trimmed,
        createdAt: data.created_at,
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

  /**
   * Leave room rules:
   * - If the game is in_progress or completed: NOBODY can leave.
   * - If the host leaves BEFORE the game starts (waiting/countdown):
   *   the entire room is deleted, kicking all players out.
   * - If a non-host leaves before the game starts: they remove themselves
   *   and the player count is decremented.
   */
  const leaveRoom = useCallback(async () => {
    const currentRoom = roomRef.current
    if (!currentRoom) return

    // Nobody can leave a game that is already in progress or completed
    if (currentRoom.status === 'in_progress' || currentRoom.status === 'completed') {
      return
    }

    // Host leaving before game starts -> delete the room entirely.
    // This cascades to room_players and kicks everyone out.
    if (isHostRef.current) {
      await supabase.from('game_rooms').delete().eq('id', roomId)
      await channelRef.current?.unsubscribe()
      return
    }

    // Non-host leaving -> remove self from the room
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
    isHost,
    sendMessage,
    updateMyTeam,
    startCountdown,
    leaveRoom,
    broadcast,
    countdownServerTs,
  }
}
