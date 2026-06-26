// src/pages/multiplayer/BrowseRooms.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Lock, Users, RefreshCw, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { hashPassword } from '../../lib/crypto'
import { MULTIPLAYER_GAME_MAP } from './multiplayerGameData'
import type { PublicRoomCard, JoinPrivateRoomResult } from './multiplayerTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function BrowseRooms() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  const [rooms, setRooms] = useState<PublicRoomCard[]>([])
  const [loading, setLoading] = useState(true)

  // Private room join — 8-char short code + optional password
  const [shortCode, setShortCode] = useState('')
  const [privatePassword, setPrivatePassword] = useState('')
  const [joiningPrivate, setJoiningPrivate] = useState(false)
  const [privateError, setPrivateError] = useState<string | null>(null)

  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [filterGame, setFilterGame] = useState<string>('all')

  // ── Fetch public rooms ─────────────────────────────────────────────────────
  // NOTE: current_player_count in the DB row is kept in sync by the
  // trg_sync_player_count trigger. We display it directly rather than
  // counting room_players here to keep the query light. The live player
  // count inside the lobby uses the room_players array directly (always
  // authoritative). Browse only needs an approximate count.
  const fetchRooms = useCallback(async () => {
    setLoading(true)
    const { data: rawRooms } = await supabase
      .from('game_rooms')
      .select(`
        id, game_id, room_name, host_id, is_private, status,
        max_player_count, min_player_count, current_player_count,
        team_mode, countdown_start_at, created_at, short_code,
        host_profile:host_id ( username, display_name ),
        room_players ( team )
      `)
      .eq('status', 'waiting')
      .eq('is_private', false)
      .order('created_at', { ascending: false })

    if (rawRooms) {
      const cards: PublicRoomCard[] = rawRooms
        // Filter full rooms client-side — keeps UI in sync even if DB trigger lags
        .filter((r: Record<string, unknown>) => {
          const current = r.current_player_count as number
          const max = r.max_player_count as number
          return current < max
        })
        .map((r: Record<string, unknown>) => {
          const host = r.host_profile as { username: string; display_name: string | null } | null
          const players = (r.room_players as { team: string | null }[] | null) ?? []
          return {
            ...(r as unknown as PublicRoomCard),
            hostName: host?.display_name || host?.username || 'Player',
            teamA: players.filter(p => p.team === 'A').length,
            teamB: players.filter(p => p.team === 'B').length,
          }
        })
      setRooms(cards)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRooms()

    // Realtime subscription: re-fetch on ANY game_rooms change so the list
    // stays live without requiring manual refresh.
    const channel: RealtimeChannel = supabase
      .channel('browse-rooms-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms' },
        () => { fetchRooms() }
      )
      // Also watch room_players inserts so the player count badge updates
      // the moment someone joins a room visible in the list.
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

  // ── Join public room ────────────────────────────────────────────────────────
  async function joinPublicRoom(roomId: string) {
    if (!myId) return
    setJoiningId(roomId)

    // Duplicate-member guard — safe to call even if already a member
    const { data: existing } = await supabase
      .from('room_players')
      .select('player_id')
      .eq('room_id', roomId)
      .eq('player_id', myId)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase.from('room_players').insert({
        room_id: roomId,
        player_id: myId,
        is_host: false,
        team: null,
      })
      if (error) {
        setJoiningId(null)
        return
      }
    }

    setJoiningId(null)
    navigate(`/multiplayer/room/${roomId}`)
  }

  // ── Join private room via 8-char short code ─────────────────────────────────
  // The short code lookup is resolved server-side in the updated RPC
  // `join_private_room_by_code` which accepts p_short_code + p_password.
  // After a successful join the RPC returns the UUID roomId so we can navigate.
  async function joinPrivateRoom() {
    const code = shortCode.trim().toUpperCase()
    if (!code) return
    if (code.length !== 8) {
      setPrivateError('Room codes are exactly 8 characters')
      return
    }

    setJoiningPrivate(true)
    setPrivateError(null)

    const hashedPw = privatePassword.trim()
      ? await hashPassword(privatePassword.trim())
      : ''

    const { data, error } = await supabase.rpc('join_private_room_by_code', {
      p_short_code: code,
      p_password:   hashedPw,
    })

    setJoiningPrivate(false)

    if (error) {
      setPrivateError(error.message)
      return
    }

    const result = data as JoinPrivateRoomResult & { room_id?: string }
    if (!result.ok) {
      setPrivateError(result.error ?? 'Could not join room')
      return
    }

    if (!result.room_id) {
      setPrivateError('Room not found')
      return
    }

    navigate(`/multiplayer/room/${result.room_id}`)
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
          className="ml-auto w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
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

      {/* ── Join via code (private rooms only) ── */}
      <section
        className="rounded-2xl p-4 space-y-3"
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(108,80,255,0.18)',
        }}
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
          {/* Short code input — max 8 chars, auto uppercase */}
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
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none font-mono tracking-widest"
            style={{
              background: 'var(--surface2)',
              border: shortCode.length === 8
                ? '1px solid rgba(108,80,255,0.5)'
                : '1px solid rgba(108,80,255,0.15)',
              color: 'var(--text)',
              letterSpacing: '0.15em',
            }}
          />

          {/* Password — only shown when a code is present */}
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
              cursor: shortCode.trim().length === 8 ? 'pointer' : 'not-allowed',
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

      {/* ── Public rooms list ── */}
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

        {!loading && filteredRooms.length === 0 && (
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
            const game = MULTIPLAYER_GAME_MAP[room.game_id as keyof typeof MULTIPLAYER_GAME_MAP]
            // Use live current_player_count (kept in sync by DB trigger)
            const count    = room.current_player_count
            const max      = room.max_player_count
            const slotsLeft = max - count
            const isFull   = slotsLeft <= 0
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
                    {/* count/max — count comes from DB trigger which includes the host */}
                    <span className="text-[11px] font-bold">{count}/{max}</span>
                  </div>
                </div>

                {/* Host */}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Host: <span style={{ color: 'var(--text-dim)' }}>{room.hostName}</span>
                </p>

                {/* Slots remaining */}
                <div>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{
                      background: isFull ? 'rgba(255,79,79,0.1)' : 'rgba(62,207,142,0.1)',
                      color: isFull ? '#ff4f4f' : '#3ecf8e',
                    }}
                  >
                    {isFull ? 'Room Full' : `${slotsLeft} slot${slotsLeft !== 1 ? 's' : ''} left`}
                  </span>
                </div>

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
                  className="w-full py-2 rounded-xl font-bold text-xs transition-opacity"
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
