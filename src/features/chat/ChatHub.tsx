// src/features/chat/ChatHub.tsx
// Single Discord-style hub: a persistent left icon rail (Friends shortcut,
// then Chats/Clubs quick-nav, then one icon per joined group chat and
// club) drives which screen shows on the right — no tab bar, no sliding
// underline. Which screen is active is driven entirely by the `tab` URL
// param (?tab=chats|clubs), so IconRail can switch screens with a plain
// navigate() call from anywhere, including while jumping straight into a
// specific room via `state: { openRoomId }`. Chat.tsx and ClubsList.tsx
// both open their own realtime subscriptions, so only the active screen's
// component is ever mounted.
//
// Phase 2 of the Clubs redesign: Global Chat is no longer a dedicated tab.
// It's invite-link-only now, and once joined it's just another room inside
// the 'chats' screen (pinned first, same sort as before).

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../shared/lib/supabase'
import { getUnreadCounts } from '../../shared/lib/unread'
import Chat from './Chat'
import ClubsList from '../clubs/ClubsList'
import IconRail from './IconRail'

export type HubTab = 'chats' | 'clubs'

function isHubTab(v: string | null): v is HubTab {
  return v === 'chats' || v === 'clubs'
}

/** Old bookmarked/shared links used ?tab=global — Global Chat now just
 *  lives inside 'chats', so send those straight there. */
function normalizeTab(v: string | null): HubTab {
  if (v === 'global') return 'chats'
  return isHubTab(v) ? v : 'chats'
}

export default function ChatHub() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  // Defaults to Chats (the "Messages" list) — no tab param means "just
  // show me who I talk to", which is the common case landing on /chat.
  const active: HubTab = normalizeTab(searchParams.get('tab'))
  const [badges, setBadges] = useState<Record<HubTab, number>>({ chats: 0, clubs: 0 })
  // On mobile, once a conversation is open with no list beside it, the rail
  // is dead weight cramping the chat — hide it so the chat gets the full
  // screen, same as Discord. Chat.tsx reports this via onFullScreenChatChange.
  const [hideRailForMobileChat, setHideRailForMobileChat] = useState(false)

  // Icon-rail badges (Chats/Clubs dots) — a lightweight aggregate pass,
  // independent of whichever screen is actually mounted. Global Chat's
  // unread counts into 'chats' now — it's just another room in that list.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function loadBadges() {
      const { data: memberRooms } = await supabase
        .from('room_members')
        .select('room_id, chat_rooms!inner(type)')
        .eq('user_id', user!.id)
      if (!memberRooms || cancelled) return

      const dmIds = memberRooms.filter((r: any) => ['dm', 'group', 'global'].includes(r.chat_rooms.type)).map((r: any) => r.room_id)
      const clubIds = memberRooms.filter((r: any) => r.chat_rooms.type === 'club').map((r: any) => r.room_id)

      const [dmCounts, clubCounts] = await Promise.all([
        getUnreadCounts(supabase, dmIds, user!.id),
        getUnreadCounts(supabase, clubIds, user!.id),
      ])
      if (cancelled) return
      const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)
      setBadges({ chats: sum(dmCounts), clubs: sum(clubCounts) })
    }

    loadBadges()
    const ch = supabase
      .channel('chat-hub-badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadBadges)
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [user])

  // Clear this screen's badge locally the moment it's opened — the underlying
  // screens (Chat.tsx / ClubsList.tsx) handle the real last_read_at writes;
  // this just keeps the rail from showing a stale dot while they do.
  useEffect(() => {
    setBadges(b => ({ ...b, [active]: 0 }))
    setHideRailForMobileChat(false)
  }, [active])

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {!hideRailForMobileChat && <IconRail active={active} badges={badges} />}
      <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
        {active === 'chats' && <Chat roomFilter="dms" onFullScreenChatChange={setHideRailForMobileChat} />}
        {active === 'clubs' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '0 12px' }}>
            <ClubsList embedded />
          </div>
        )}
      </div>
    </div>
  )
}
