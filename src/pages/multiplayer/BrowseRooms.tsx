// src/pages/multiplayer/BrowseRooms.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Lock, Users, RefreshCw, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { hashPassword } from '../../lib/crypto'
import { MULTIPLAYER_GAME_MAP } from './multiplayerGameData'
import type { PublicRoomCard } from './multiplayerTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function BrowseRooms() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  const [rooms,           setRooms]           = useState<PublicRoomCard[]>([])
  const [loading,         setLoading]         = useState(true)
  const [fetchError,      setFetchError]      = useState<string | null>(null)

  // Private room join — 8-char short code + optional password
  const [shortCode,       setShortCode]       = useState('')
  const [privatePassword, setPrivatePassword] = useState('')
  const [joiningPrivate,  setJoiningPrivate]  = useState(false)
  const [privateError,    setPrivateError]    = useState<string | null>(null)

  const [joiningId,  setJoiningId]  = useState<string | null>(null)
  const [filterGame, setFilterGame] = useState<string>('all')

  // -----------------------------------------------------------------
  // fetchRooms
  // Uses the actual room_players row count as the authoritative player
  // count — never relies on the cached current_player_count column.
  // -----------------------------------------------------------------
  const fetchRooms = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    const { data: rawRooms, error } = await supabase
      .from('game_rooms')
      .select(`
        id, game_id, room_name, host_id, is_private, status,
        max_player_count, min_player_count, current_player_count,
        team_mode, countdown_start_at, created_at,
        host_profile:host_id ( username, display_name ),
        room_players ( team )
      `)
      .eq('status', 'waiting')
      .eq('is_private', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[BrowseRooms] fetchRooms error:', error.message)
      setFetchError(error.message)
      setLoading(false)
      return
    }

    if (rawRooms) {
      const cards: PublicRoomCard[] = rawRooms
        // Filter full rooms using the GROUND-TRUTH player count from the
        // room_players join — never the cached current_player_count column.
        .filter((r: Record<string, unknown>) => {
          const players = (r.room_players as { team: string | null }[] | null) ?? []
          const max     = r.max_player_count as number
          return players.length < max
        })
        .map((r: Record<string, unknown>) => {
          const host    = r.host_profile as { username: string; display_name: string | null } | null
          const players = (r.room_players as { team: string | null }[] | null) ?? []
          return {
            ...(r as unknown as PublicRoomCard),
            short_code: '',   // not fetched here — safe default for the type
            hostName: host?.display_name || host?.username || 'Player',
            teamA: players.filter(p => p.team === 'A').length,
            teamB: players.filter(p => p.team === 'B').length,
          }
        })
      setRooms(cards)
    }

    setLoading(false)
  }, [])

  // -----------------------------------------------------------------
  // Realtime: re-fetch on any game_rooms or room_players change
  // -----------------------------------------------------------------
  useEffect(() => {
    fetchRooms()

    const channel: RealtimeChannel = supabase
      .channel('browse-rooms-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms' },
        () => { fetchRooms() }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_players' },
        () => { fetchRooms() }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_players' },
        () => { fetchRooms() }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [fetchRooms])

  // -----------------------------------------------------------------
  // Join public room
  // Checks capacity using an atomic read of the actual room_players
  // count before inserting, preventing race-condition overfill.
  // -----------------------------------------------------------------
  async function joinPublicRoom(roomId: string) {
    if (!myId) return
    setJoiningId(roomId)

    try {
      // 1. Check if already a member
      const { data: existing } = await supabase
        .from('room_players')
        .select('player_id')
        .eq('room_id', roomId)
        .eq('player_id', myId)
        .maybeSingle()

      if (!existing) {
        // 2. Read the ACTUAL player count directly from room_players
        const { count: actualCount, error: countErr } = await supabase
          .from('room_players')
          .select('*', { head: true, count: 'exact' })
          .eq('room_id', roomId)

        if (countErr) {
          console.error('[BrowseRooms] count error:', countErr.message)
          setJoiningId(null)
          return
        }

        // 3. Also read the room's max + status in the same check window
        const { data: roomRow, error: roomErr } = await supabase
          .from('game_rooms')
          .select('max_player_count, status')
          .eq('id', roomId)
          .single()

        if (roomErr || !roomRow || roomRow.status !== 'waiting') {
          setJoiningId(null)
          return // Room gone or no longer waiting
        }

        if (typeof actualCount === 'number' && actualCount >= roomRow.max_player_count) {
          setJoiningId(null)
          return // Room became full between our fetch and click
        }

        // 4. Insert player
        const { error: insertErr } = await supabase.from('room_players').insert({
          room_id:   roomId,
          player_id: myId,
          is_host:   false,
          team:      null,
        })

        if (insertErr) {
          // Duplicate key means another tab/client raced and won — that's fine,
          // just navigate into the room.
          if (!insertErr.message.includes('duplicate')) {
            console.error('[BrowseRooms] joinPublicRoom error:', insertErr.message)
            setJoiningId(null)
            return
          }
        }

        // 5. Best-effort sync of the cached count column
        const { count: freshCount } = await supabase
          .from('room_players')
          .select('*', { head: true, count: 'exact' })
          .eq('room_id', roomId)

        if (typeof freshCount === 'number') {
          await supabase
            .from('game_rooms')
            .update({ current_player_count: freshCount })
            .eq('id', roomId)
        }
      }

      navigate(`/multiplayer/room/${roomId}`)
    } finally {
      setJoiningId(null)
    }
  }

  // -----------------------------------------------------------------
  // Join private room via 8-char short code
  // -----------------------------------------------------------------
  async function joinPrivateRoom() {
    const code = shortCode.trim().toUpperCase()
    if (code.length !== 8) {
      setPrivateError('Room codes are exactly 8 characters')
      return
    }

    setJoiningPrivate(true)
    setPrivateError(null)

    try {
      const hashedPw = privatePassword.trim()
        ? await hashPassword(privatePassword.trim())
        : ''

      const { data, error } = await supabase.rpc('join_private_room_by_code', {
        p_short_code: code,
        p_password:   hashedPw,
      })

      if (error) {
        setPrivateError(error.message)
        return
      }

      const result = data as { ok: boolean; error?: string; room_id?: string }
      if (!result.ok) {
        setPrivateError(result.error ?? 'Could not join room')
        return
      }
      if (!result.room_id) {
        setPrivateError('Room not found')
        return
      }

      navigate(`/multiplayer/room/${result.room_id}`)
    } finally {
      setJoiningPrivate(false)
    }
  }

  const filteredRooms = filterGame === 'all'
    ? rooms
    : rooms.filter(r => r.game_id === filterGame)

  const uniqueGames = Array.from(new Set(rooms.map(r => r.game_id)))

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/multiplayer')}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            color: 'var(--text-dim)',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-extrabold text-xl" style={{ color: 'var(--text)' }}>
          Browse Rooms
        </h1>
        <button
          type="button"
          onClick={fetchRooms}
          className="ml-auto w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            color: 'var(--text-dim)',
          }}
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(255,79,79,0.1)', color: '#ff4f4f', border: '1px solid rgba(255,79,79,0.2)' }}
        >
          <strong>Could not load rooms:</strong> {fetchError}
        </div>
      )}

      {/* -- Join via code (private rooms only) -- */}
      <section
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid rgba(108,80,255,0.18)' }}
      >
        <div className="flex items-center gap-2">
          <Lock size={14} style={{ color: '#a78bfa' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Join a Private Room
          </p>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Enter the 8-character code shared by your host.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={shortCode}
            onChange={e => {
              const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
              setShortCode(val)
              setPrivateError(null)
            }}
            placeholder="Room code (8 chars)"
            maxLength={8}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
            style={{
              background: 'var(--surface2)',
              border: shortCode.length === 8
                ? '1px solid rgba(108,80,255,0.5)'
                : '1px solid rgba(108,80,255,0.15)',
              color: 'var(--text)',
              letterSpacing: '0.15em',
            }}
          />

          {shortCode.trim().length > 0 && (
            <div className="relative flex-1">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                value={privatePassword}
                onChange={e => setPrivatePassword(e.target.value)}
                placeholder="Password (if required)"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid rgba(108,80,255,0.15)',
                  color: 'var(--text)',
                }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={joinPrivateRoom}
            disabled={shortCode.trim().length !== 8 || joiningPrivate}
            className="px-4 py-2.5 rounded-xl font-bold text-sm flex-shrink-0"
            style={{
              background: shortCode.trim().length === 8
                ? 'linear-gradient(135deg, #6c50ff, #a78bfa)'
                : 'var(--surface2)',
              color: shortCode.trim().length === 8 ? '#fff' : 'var(--text-muted)',
              border: 'none',
              cursor: shortCode.trim().length === 8 && !joiningPrivate ? 'pointer' : 'not-allowed',
              opacity: joiningPrivate ? 0.7 : 1,
            }}
          >
            {joiningPrivate ? 'Joining…' : 'Join'}
          </button>
        </div>

        {privateError && (
          <p className="text-xs" style={{ color: '#ff4f4f' }}>{privateError}</p>
        )}
      </section>

      {/* -- Public rooms list -- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={14} style={{ color: '#00e5ff' }} />
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Open Rooms
            </p>
            {!loading && (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: 'rgba(0,229,255,0.1)', color: '#00e5ff' }}
              >
                {filteredRooms.length}
              </span>
            )}
          </div>

          {uniqueGames.length > 1 && (
            <select
              value={filterGame}
              onChange={e => setFilterGame(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5 outline-none"
              style={{
                background: 'var(--surface2)',
                border: '1px solid rgba(108,80,255,0.2)',
                color: 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              <option value="all">All games</option>
              {uniqueGames.map(gId => (
                <option key={gId} value={gId}>
                  {MULTIPLAYER_GAME_MAP[gId as keyof typeof MULTIPLAYER_GAME_MAP]?.name ?? gId}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <div
              className="inline-block w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mb-3"
              style={{ borderColor: 'rgba(108,80,255,0.4)', borderTopColor: '#6c50ff' }}
            />
            <p className="text-sm">Finding rooms…</p>
          </div>
        )}

        {!loading && !fetchError && filteredRooms.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-3xl">🎮</p>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-dim)' }}>
              No open rooms right now
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Be the first — create a room and others will join.
            </p>
            <button
              type="button"
              onClick={() => navigate('/multiplayer/create')}
              className="mt-3 px-5 py-2 rounded-xl font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, #6c50ff, #a78bfa)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Create Room
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredRooms.map(room => {
            const game      = MULTIPLAYER_GAME_MAP[room.game_id as keyof typeof MULTIPLAYER_GAME_MAP]
            // Use the authoritative current_player_count from the DB row,
            // which is kept in sync by syncPlayerCount in useRoom.
            const count     = room.current_player_count
            const max       = room.max_player_count
            const slotsLeft = max - count
            const isFull    = slotsLeft <= 0
            const isJoining = joiningId === room.id

            return (
              <div
                key={room.id}
                className="rounded-2xl p-4 space-y-3"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl flex-shrink-0">{game?.emoji ?? '🎮'}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                        {room.room_name}
                      </p>
                      <p className="text-[11px] font-semibold" style={{ color: '#a78bfa' }}>
                        {game?.name ?? room.game_id}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: isFull ? 'rgba(255,79,79,0.12)' : 'rgba(0,229,255,0.1)',
                      color: isFull ? '#ff4f4f' : '#00e5ff',
                    }}
                  >
                    <Users size={11} />
                    <span className="text-[11px] font-bold">{count}/{max}</span>
                  </div>
                </div>

                {/* Host */}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Host: <span style={{ color: 'var(--text-dim)' }}>{room.hostName}</span>
                </p>

                {/* Slots remaining */}
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    background: isFull ? 'rgba(255,79,79,0.1)' : 'rgba(62,207,142,0.1)',
                    color: isFull ? '#ff4f4f' : '#3ecf8e',
                  }}
                >
                  {isFull ? 'Room Full' : `${slotsLeft} slot${slotsLeft !== 1 ? 's' : ''} left`}
                </span>

                {/* Team balance */}
                {game?.teamCapability === 'optional-2v2' && count > 0 && (
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Team A: <span style={{ color: '#4f8ef7' }}>{room.teamA}</span>
                    {'  ·  '}
                    Team B: <span style={{ color: '#9b6dff' }}>{room.teamB}</span>
                  </p>
                )}

                {/* Join button */}
                <button
                  type="button"
                  onClick={() => !isFull && !isJoining && joinPublicRoom(room.id)}
                  disabled={isFull || isJoining}
                  className="w-full py-2 rounded-xl font-bold text-xs"
                  style={{
                    background: isFull
                      ? 'var(--surface2)'
                      : 'linear-gradient(135deg, #6c50ff, #a78bfa)',
                    color: isFull ? 'var(--text-muted)' : '#fff',
                    border: 'none',
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isJoining ? 0.7 : 1,
                  }}
                >
                  {isJoining ? 'Joining…' : isFull ? 'Room Full' : 'Join Game'}
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
