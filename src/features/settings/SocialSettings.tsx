// src/features/settings/SocialSettings.tsx — Settings › Social
// Age restriction, status sharing (followers/following, game progression,
// online activity), and the blocked accounts entry point.
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Users, Trophy, Wifi, Ban } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useProfile } from '../profile/useProfile'
import { SettingsShell, SectionTitle, InfoLine, ErrorLine, Row, ToggleRow, useProfileField } from './settingsShared'

export default function SocialSettings() {
  const navigate = useNavigate()
  const { profile } = useProfile()

  const ageRestricted = useProfileField<boolean>(profile, 'age_restricted', false)
  const followCounts = useProfileField<boolean>(profile, 'show_follow_counts', true)
  const gameProgression = useProfileField<boolean>(profile, 'show_game_progression', true)
  const onlineActivity = useProfileField<boolean>(profile, 'show_online_activity', true)

  return (
    <SettingsShell title="Social">
      <SectionTitle>Age restriction</SectionTitle>
      <ToggleRow
        icon={<ShieldAlert size={15} />} iconBg="rgba(255,79,79,0.12)" iconColor="var(--red)"
        label="Age restriction" sub="Enable this for DMs."
        on={ageRestricted.value} onToggle={() => ageRestricted.save(!ageRestricted.value)}
      />
      <InfoLine>Turning this on prevents you from sending or receiving 18+ content in direct messages.</InfoLine>
      <ErrorLine>{ageRestricted.error}</ErrorLine>

      <SectionTitle>Status sharing</SectionTitle>
      <InfoLine>Share things with friends.</InfoLine>
      <div className="settings-card">
        <ToggleRow
          icon={<Users size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="var(--blue)"
          label="Followers and following" sub="Show your counts on your profile"
          on={followCounts.value} onToggle={() => followCounts.save(!followCounts.value)}
        />
        <ToggleRow
          icon={<Trophy size={15} />} iconBg="rgba(245,197,66,0.12)" iconColor="var(--gold)"
          label="Game progression" sub="Alert followers on full map completions and top-3 leaderboard ranks"
          on={gameProgression.value} onToggle={() => gameProgression.save(!gameProgression.value)}
        />
        <ToggleRow
          icon={<Wifi size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
          label="Online activity" sub="Followers are notified when you come online"
          on={onlineActivity.value} onToggle={() => onlineActivity.save(!onlineActivity.value)}
        />
      </div>
      <InfoLine>Turning off game progression also removes your current rank badge from your profile.</InfoLine>
      <ErrorLine>{followCounts.error || gameProgression.error || onlineActivity.error}</ErrorLine>

      <SectionTitle>Blocked accounts</SectionTitle>
      <Row
        icon={<Ban size={15} />} iconBg="rgba(255,79,79,0.12)" iconColor="var(--red)"
        label="Blocked accounts" sub="See and unblock the accounts you've blocked"
        onClick={(e) => { ripple(e); navigate('/settings/social/blocked') }}
      />
      <InfoLine>Blocked accounts stay listed there so you can unblock anytime.</InfoLine>
    </SettingsShell>
  )
}
