// src/context/OnlinePresence.tsx
//
// App-wide online presence — single 'chat-online-presence' channel, tracked
// once here at the app root (mounted in AppLayout, so it reflects being
// anywhere in the app, not just the Chat screen). Exposed via context so
// any component — Chat's DM list, a profile's green dot, the Friends
// Online widget — reads the same live Set<string> without each opening
// its own subscription to the same topic (supabase-js dedupes channel
// objects by topic name per client, so a second independent .channel()
// call for this same topic would hand back the already-subscribed
// instance and throw on a second .on('presence', ...) — same failure
// mode the original inline effect in Chat.tsx guarded against). One
// tracker, many readers.
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../shared/lib/supabase'

const Ctx = createContext<Set<string>>(new Set())

export function OnlinePresenceProvider({ myId, children }: { myId: string | null; children: ReactNode }) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!myId) return
    const channel = supabase.channel('chat-online-presence', { config: { presence: { key: myId } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineUserIds(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online: true })
      })
    return () => {
      // removeChannel() must run synchronously so the topic is freed from
      // the client's registry immediately — see note above re: a fast
      // remount re-requesting this same topic before cleanup finishes.
      channel.untrack()
      supabase.removeChannel(channel)
      supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', myId)
    }
  }, [myId])

  return <Ctx.Provider value={onlineUserIds}>{children}</Ctx.Provider>
}

/** Live set of currently-online user ids. Safe to call from anywhere inside AppLayout's tree. */
export function useOnlineUserIds(): Set<string> {
  return useContext(Ctx)
}
