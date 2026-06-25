// src/pages/multiplayer/BrowseRooms.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Lock, Users, RefreshCw, ChevronLeft, Hash } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { MULTIPLAYER_GAME_MAP } from './multiplayerGameData'
import type { PublicRoomCard, JoinPrivateRoomResult } from './multiplayerTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function BrowseRooms() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  const [rooms, setRooms] = useState<PublicRoomCard[]>([])
  const [loading, setLoading] = useState(true)

  // Private join via code
  const [roomCode, setRoomCode] = useState('')
  const [privatePassword, setPrivatePassword] = useState('')
  const [joiningPrivate, setJoiningPrivate] = useState(false)
  const [privateError, setPrivateError] = useState<string | null>(null)

  // Public join loading state
  const [joiningId, setJoiningId] = useState<string | null>(null)

  // Filter
  const [filterGame, setFilterGame] = useState<string>('all')

  async function fetchRooms() {
    setLoading(true)
    const { data } = await supabase
      .from('game_rooms')
      .select(`
        *,
        host_profile:host_id (
          username,
          display_name
        ),
        room_players (
          team
        )
      `)
      .eq('status', 'waiting')
      .eq('is_private', false)
      .lt('current_player_count', supabase.rpc as unknown as never)  // filter happens in query below

    // Re-do the query properly (supabase JS v2)
    const { data: rawRooms } = await supabase
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

    if (rawRooms) {
      const cards: PublicRoomCard[] = rawRooms
        .filter((r: Record<string, unknown>) => (r.current_player_count as number) < (r.max_player_count as number))
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
  }

  useEffect(() => {
    fetchRooms()

    // Real-time: Postgres Changes on game_rooms
    const channel: RealtimeChannel = supabase
      .channel('browse-rooms')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: "status=eq.waiting",
        },
        () => {
          // Re-fetch on any change — simple and correct
          fetchRooms()
        }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function joinPublicRoom(roomId: string) {
    if (!myId) return
    setJoiningId(roomId)
    const { error } = await supabase.from('room_players').insert({
      room_id: roomId,
      player_id: myId,
      is_host: false,
      team: null,
    })
    setJoiningId(null)
    if (!error) {
      navigate(`/multiplayer/room/${roomId}`)
    }
  }

  async function joinPrivateRoom() {
    if (!roomCode.trim()) return
    setJoiningPrivate(true)
    setPrivateError(null)

    const { data, error } = await supabase.rpc('join_private_room', {
      p_room_id: roomCode.trim(),
      p_password: privatePassword.trim(),
    })

    setJoiningPrivate(false)

    if (error) {
      setPrivateError(error.message)
      return
    }

    const result = data as JoinPrivateRoomResult
    if (!result.ok) {
      setPrivateError(result.error ?? 'Could not join room')
      return
    }

    navigate(`/multiplayer/room/${roomCode.trim()}`)
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
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── Join via code (private rooms) ── */}
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
            Join via Room Code
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value)}
              placeholder="Room ID"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--surface2)',
                border: '1px solid rgba(108,80,255,0.15)',
                color: 'var(--text)',
              }}
            />
          </div>
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
          <button
            type="button"
            onClick={joinPrivateRoom}
            disabled={!roomCode.trim() || joiningPrivate}
            className="px-4 py-2.5 rounded-xl font-bold text-sm flex-shrink-0"
            style={{
              background: roomCode.trim() ? 'linear-gradient(135deg, #6c50ff, #a78bfa)' : 'var(--surface2)',
              color: roomCode.trim() ? '#fff' : 'var(--text-muted)',
              border: 'none',
              cursor: roomCode.trim() ? 'pointer' : 'not-allowed',
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

          {/* Game filter */}
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
            <div className="inline-block w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mb-3" style={{ borderColor: 'rgba(108,80,255,0.4)', borderTopColor: 'transparent' }} />
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
              Be the first — create a room and others will join!
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
            const isFull = room.current_player_count >= room.max_player_count
            const isJoining = joiningId === room.id
            const alreadyIn = false // could check via players list if needed

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
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {game?.name ?? room.game_id}
                      </p>
                    </div>
                  </div>

                  {/* Player count badge */}
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: isFull ? 'rgba(255,79,79,0.12)' : 'rgba(0,229,255,0.1)',
                      color: isFull ? '#ff4f4f' : '#00e5ff',
                    }}
                  >
                    <Users size={11} />
                    <span className="text-[11px] font-bold">
                      {room.current_player_count}/{room.max_player_count}
                    </span>
                  </div>
                </div>

                {/* Host */}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Host: <span style={{ color: 'var(--text-dim)' }}>{room.hostName}</span>
                </p>

                {/* Team balance (for 2v2-capable games) */}
                {game?.teamCapability === 'optional-2v2' && room.current_player_count > 0 && (
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Team A: <span style={{ color: '#4f8ef7' }}>{room.teamA}</span>
                    {'  ·  '}
                    Team B: <span style={{ color: '#9b6dff' }}>{room.teamB}</span>
                  </p>
                )}

                {/* Join button */}
                <button
                  type="button"
                  onClick={() => !isFull && joinPublicRoom(room.id)}
                  disabled={isFull || isJoining || alreadyIn}
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
