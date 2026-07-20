// src/features/settings/OtherNotifications.tsx — Settings › Other notifications
// Hub page plus three sub-sections (Chillverse app events, Highlights,
// Activities incl. the nested Status picker) selected by route param.
import { useNavigate, useParams } from 'react-router-dom'
import {
  Compass, Gift, Heart, TimerReset, Sparkles, Wifi, Activity,
  Users, Globe, EyeOff, Circle, Moon,
} from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useProfile } from '../profile/useProfile'
import { supabase } from '../../shared/lib/supabase'
import {
  SettingsShell, SectionTitle, InfoLine, ErrorLine, Row, ToggleRow,
  ChoiceGroup, useProfileField,
} from './settingsShared'

function Hub() {
  const navigate = useNavigate()
  return (
    <SettingsShell title="Other notifications">
      <div className="settings-card">
        <Row icon={<Sparkles size={15} />} iconBg="color-mix(in srgb, var(--accent) 12%, transparent)" iconColor="var(--accent)"
          label="Chillverse" sub="Exploration, gifts, profile likes, session resets"
          onClick={(e) => { ripple(e); navigate('/settings/other-notifications/chillverse') }}
        />
        <Row icon={<Heart size={15} />} iconBg="rgba(255,77,139,0.12)" iconColor="var(--pink)"
          label="Highlights" sub="Highlight posts and follower activity"
          onClick={(e) => { ripple(e); navigate('/settings/other-notifications/highlights') }}
        />
        <Row icon={<Activity size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
          label="Activities" sub="Live readers and your status"
          onClick={(e) => { ripple(e); navigate('/settings/other-notifications/activities') }}
        />
      </div>
    </SettingsShell>
  )
}

function ChillverseSection() {
  const { profile } = useProfile()
  const exploration = useProfileField<boolean>(profile, 'notif_exploration', true)
  const gifts = useProfileField<boolean>(profile, 'notif_gifts', true)
  const likes = useProfileField<boolean>(profile, 'notif_profile_likes', true)
  const sessionReset = useProfileField<boolean>(profile, 'notif_session_reset', true)

  return (
    <SettingsShell title="Chillverse">
      <div className="settings-card">
        <ToggleRow icon={<Compass size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="var(--blue)"
          label="Exploration" sub="Notified when you finish exploring"
          on={exploration.value} onToggle={() => exploration.save(!exploration.value)} />
        <ToggleRow icon={<Gift size={15} />} iconBg="rgba(255,77,139,0.12)" iconColor="var(--pink)"
          label="Gifts" sub="Notified if someone gifts you"
          on={gifts.value} onToggle={() => gifts.save(!gifts.value)} />
        <ToggleRow icon={<Heart size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="var(--purple)"
          label="Profile likes" sub="Notified if someone likes your profile"
          on={likes.value} onToggle={() => likes.save(!likes.value)} />
        <ToggleRow icon={<TimerReset size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
          label="Session reset" sub="Notified when your session limit resets"
          on={sessionReset.value} onToggle={() => sessionReset.save(!sessionReset.value)} />
      </div>
      <InfoLine>These apply both in-app and as system notifications.</InfoLine>
      <ErrorLine>{exploration.error || gifts.error || likes.error || sessionReset.error}</ErrorLine>
    </SettingsShell>
  )
}

function HighlightsSection() {
  const { profile } = useProfile()
  const scope = useProfileField<'everyone' | 'followers'>(profile, 'highlight_notif_scope', 'everyone')
  const followerOnline = useProfileField<boolean>(profile, 'notif_follower_online', true)

  return (
    <SettingsShell title="Highlights">
      <SectionTitle>Get notified when a highlight is posted</SectionTitle>
      <ChoiceGroup
        value={scope.value}
        onPick={(v) => scope.save(v)}
        options={[
          { id: 'followers', label: 'Followers only', sub: 'Only highlights from people you follow', icon: <Users size={14} />, color: 'var(--blue)' },
          { id: 'everyone', label: 'Everyone', sub: 'Any highlight on Chillverse', icon: <Globe size={14} />, color: 'var(--green)' },
        ]}
      />
      <InfoLine>
        Choosing "Everyone" makes highlight notifications from people you don't follow use the generic
        format "Someone posted a highlight" — it won't name who.
      </InfoLine>
      <ErrorLine>{scope.error}</ErrorLine>

      <SectionTitle>Followers</SectionTitle>
      <ToggleRow icon={<Wifi size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
        label="Get notified when a follower comes online"
        on={followerOnline.value} onToggle={() => followerOnline.save(!followerOnline.value)} />
      <ErrorLine>{followerOnline.error}</ErrorLine>
    </SettingsShell>
  )
}

const PRESENCE_OPTIONS = [
  { id: 'online', label: 'Online', sub: 'Visible to everyone, shown as active.', color: 'var(--green)', Icon: Circle },
  { id: 'idle', label: 'Idle', sub: 'Visible, but marked as away.', color: 'var(--gold)', Icon: Moon },
  { id: 'offline', label: 'Offline', sub: 'Appears offline to others.', color: '#888899', Icon: Circle },
  { id: 'invisible', label: 'Invisible', sub: "Others can't search or add you to a game.", color: '#555566', Icon: EyeOff },
] as const

function ActivitiesSection() {
  const { profile } = useProfile()
  const liveReaders = useProfileField<'everyone' | 'followers' | 'none'>(profile, 'live_activity_visibility', 'everyone')
  const presence = useProfileField<string>(profile, 'presence', 'online')

  async function setPresence(id: string) {
    // presence has always been a directly-updatable column; keep the same path
    if (!profile?.id) return
    await supabase.from('profiles').update({ presence: id }).eq('id', profile.id)
  }

  return (
    <SettingsShell title="Activities">
      <SectionTitle>Live readers</SectionTitle>
      <ChoiceGroup
        value={liveReaders.value}
        onPick={(v) => liveReaders.save(v)}
        options={[
          { id: 'followers', label: 'Followers', sub: 'Only followers see your live ticker', icon: <Users size={14} />, color: 'var(--blue)' },
          { id: 'everyone', label: 'Everyone', sub: 'Anyone can see your live ticker', icon: <Globe size={14} />, color: 'var(--green)' },
          { id: 'none', label: 'None', sub: 'Hide your live ticker from everyone', icon: <EyeOff size={14} />, color: 'var(--text-muted)' },
        ]}
      />
      <InfoLine>Controls who sees your live activity ticker (e.g. "exploring right now"). "None" hides it from everyone.</InfoLine>
      <ErrorLine>{liveReaders.error}</ErrorLine>

      <SectionTitle>Status</SectionTitle>
      <InfoLine>Let others see your status on Chillverse.</InfoLine>
      <ChoiceGroup
        value={presence.value}
        onPick={(v) => { presence.save(v); setPresence(v) }}
        options={PRESENCE_OPTIONS.map(p => ({
          id: p.id, label: p.label, sub: p.sub, color: p.color, icon: <p.Icon size={14} />,
        }))}
      />
      <InfoLine>Choosing "Invisible" also prevents other users from inviting you to a game.</InfoLine>
    </SettingsShell>
  )
}

export default function OtherNotifications() {
  const { section } = useParams<{ section?: string }>()
  if (section === 'chillverse') return <ChillverseSection />
  if (section === 'highlights') return <HighlightsSection />
  if (section === 'activities') return <ActivitiesSection />
  return <Hub />
}
