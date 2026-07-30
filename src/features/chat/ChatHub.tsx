// src/features/chat/ChatHub.tsx
// Replaces the old standalone /chat (DM-only) and /clubs entry points with
// one hub: Global / Chats / Clubs as tabs, animated underline that slides
// to the active tab, active tab enlarges and doubles as the page title
// (no separate "Chat" heading). Each tab fully unmounts when inactive —
// Chat.tsx and ClubsList.tsx both open their own realtime subscriptions,
// so keeping inactive tabs mounted would mean stale/duplicate channels.

import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../shared/lib/supabase'
import { getUnreadCounts } from '../../shared/lib/unread'
import Chat from './Chat'
import ClubsList from '../clubs/ClubsList'

type HubTab = 'global' | 'chats' | 'clubs'
const TABS: { key: HubTab; label: string }[] = [
  { key: 'global', label: 'Global' },
  { key: 'chats', label: 'Chats' },
  { key: 'clubs', label: 'Clubs' },
]

function isHubTab(v: string | null): v is HubTab {
  return v === 'global' || v === 'chats' || v === 'clubs'
}

export default function ChatHub() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialTab = isHubTab(searchParams.get('tab')) ? (searchParams.get('tab') as HubTab) : 'global'
  const [active, setActive] = useState<HubTab>(initialTab)
  const [badges, setBadges] = useState<Record<HubTab, number>>({ global: 0, chats: 0, clubs: 0 })

  const tabRefs = useRef<Record<HubTab, HTMLButtonElement | null>>({ global: null, chats: null, clubs: null })
  const [underline, setUnderline] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const el = tabRefs.current[active]
    if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth })
  }, [active])

  useLayoutEffect(() => {
    const onResize = () => {
      const el = tabRefs.current[active]
      if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  // Tab-level unread badges — a lightweight aggregate pass, independent of
  // whichever tab is actually mounted (so switching tabs shows an accurate
  // count on the *other* two without needing them open).
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function loadBadges() {
      const { data: memberRooms } = await supabase
        .from('room_members')
        .select('room_id, chat_rooms!inner(type)')
        .eq('user_id', user!.id)
      if (!memberRooms || cancelled) return

      const globalIds = memberRooms.filter((r: any) => r.chat_rooms.type === 'global').map((r: any) => r.room_id)
      const dmIds = memberRooms.filter((r: any) => r.chat_rooms.type === 'dm' || r.chat_rooms.type === 'group').map((r: any) => r.room_id)
      const clubIds = memberRooms.filter((r: any) => r.chat_rooms.type === 'club').map((r: any) => r.room_id)

      const [globalCounts, dmCounts, clubCounts] = await Promise.all([
        getUnreadCounts(supabase, globalIds, user!.id),
        getUnreadCounts(supabase, dmIds, user!.id),
        getUnreadCounts(supabase, clubIds, user!.id),
      ])
      if (cancelled) return
      const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)
      setBadges({ global: sum(globalCounts), chats: sum(dmCounts), clubs: sum(clubCounts) })
    }

    loadBadges()
    // Re-check whenever a new message lands anywhere — cheap enough at this scale,
    // and simpler/more reliable than trying to patch every mutation path by hand.
    const ch = supabase
      .channel('chat-hub-badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadBadges)
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [user])

  // Clear this tab's badge locally the moment it's opened — the underlying
  // screens (Chat.tsx / ClubsList.tsx) handle the real last_read_at writes;
  // this just keeps the tab bar from showing a stale count while they do.
  useEffect(() => {
    setBadges(b => ({ ...b, [active]: 0 }))
  }, [active])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', padding: '0 4px', marginBottom: 14, flexShrink: 0 }}>
        {TABS.map(t => {
          const isActive = active === t.key
          const badge = badges[t.key]
          return (
            <button
              key={t.key}
              ref={el => { tabRefs.current[t.key] = el }}
              onClick={() => setActive(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 14px 12px', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: isActive ? 16 : 13.5, fontWeight: isActive ? 800 : 600,
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                transition: 'font-size 0.18s ease, color 0.18s ease',
              }}
            >
              {t.label}
              {badge > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--accent)',
                  borderRadius: 10, padding: '1px 6px', minWidth: 16, textAlign: 'center',
                }}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}
        <div
          style={{
            position: 'absolute', bottom: -1, height: 2, borderRadius: 2, background: 'var(--accent)',
            left: underline.left, width: underline.width,
            transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1), width 0.22s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {active === 'global' && <Chat roomFilter="global" />}
        {active === 'chats' && <Chat roomFilter="dms" />}
        {active === 'clubs' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '0 12px' }}>
            <ClubsList embedded />
          </div>
        )}
      </div>
    </div>
  )
}
