// src/features/settings/PrivacySettings.tsx — Settings › Data & Privacy
import { useNavigate, Link } from 'react-router-dom'
import { Users, Globe, FileText, Shield } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useProfile } from '../profile/useProfile'
import { SettingsShell, SectionTitle, InfoLine, ErrorLine, Row, ChoiceGroup, useProfileField } from './settingsShared'

export default function PrivacySettings() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const visibility = useProfileField<'everyone' | 'followers'>(profile, 'profile_visibility', 'everyone')

  return (
    <SettingsShell title="Data & Privacy">
      <SectionTitle>Share my full profile with</SectionTitle>
      <ChoiceGroup
        value={visibility.value}
        onPick={(v) => visibility.save(v)}
        options={[
          { id: 'followers', label: 'Followers only', sub: 'Only your followers see your full profile', icon: <Users size={14} />, color: 'var(--blue)' },
          { id: 'everyone', label: 'Everyone', sub: 'Anyone can see your full profile', icon: <Globe size={14} />, color: 'var(--green)' },
        ]}
      />
      <InfoLine>
        Controls who can see your bio, wishlist, favorite games, and stats. With "Followers only", non-followers
        who open your profile see just your avatar, name, and basic info. This does not control{' '}
        <Link to="/settings/other-notifications/activities" style={{ color: 'var(--accent)', fontWeight: 600 }}>activity</Link>{' '}
        visibility — that's separate.
      </InfoLine>
      <ErrorLine>{visibility.error}</ErrorLine>

      <SectionTitle>Policies &amp; Terms</SectionTitle>
      <div className="settings-card">
        <Row icon={<FileText size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="var(--blue)"
          label="Terms and Conditions"
          onClick={(e) => { ripple(e); navigate('/terms') }}
        />
        <Row icon={<Shield size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
          label="Privacy Policy"
          onClick={(e) => { ripple(e); navigate('/privacy') }}
        />
      </div>
    </SettingsShell>
  )
}
