// src/features/settings/AppNotifications.tsx — Settings › Chillverse › Notifications
// In-app notifications, system (push) notifications, and the global-chat
// firehose toggle. The system toggle drives BOTH the notif_system column and
// the browser push subscription, so the two can't drift apart.
import { useEffect, useState } from 'react'
import { Bell, Monitor, MessagesSquare } from 'lucide-react'
import { useProfile } from '../profile/useProfile'
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from '../notifications/push'
import { SettingsShell, InfoLine, ErrorLine, ToggleRow, useProfileField, saveProfileFields } from './settingsShared'

export default function AppNotifications() {
  const { profile } = useProfile()

  const inApp = useProfileField<boolean>(profile, 'notif_in_app', true)
  const globalChat = useProfileField<boolean>(profile, 'notif_global_chat_message', false)

  const pushSupported = isPushSupported()
  const [systemOn, setSystemOn] = useState(false)
  const [pushBlocked, setPushBlocked] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [systemError, setSystemError] = useState('')

  // Reflect browser reality, not just the stored preference — the user can
  // revoke permission from browser site settings at any time.
  useEffect(() => {
    if (!pushSupported) return
    ;(async () => {
      if (Notification.permission === 'denied') {
        setPushBlocked(true)
        setSystemOn(false)
        return
      }
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      setSystemOn(!!subscription && (profile?.notif_system ?? true))
    })()
  }, [pushSupported, profile?.notif_system])

  async function toggleSystem() {
    if (!profile?.id || pushBusy || pushBlocked || !pushSupported) return
    setPushBusy(true)
    setSystemError('')
    try {
      if (systemOn) {
        await unsubscribeFromPush(profile.id)
        await saveProfileFields(profile.id, { notif_system: false })
        setSystemOn(false)
      } else {
        await subscribeToPush(profile.id)
        if (Notification.permission === 'denied') {
          setPushBlocked(true)
          setSystemOn(false)
        } else {
          const registration = await navigator.serviceWorker.getRegistration('/')
          const subscription = await registration?.pushManager.getSubscription()
          const on = !!subscription
          setSystemOn(on)
          if (on) {
            const err = await saveProfileFields(profile.id, { notif_system: true })
            if (err) setSystemError(err)
          }
        }
      }
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <SettingsShell title="Notifications">
      <ToggleRow
        icon={<Bell size={15} />} iconBg="color-mix(in srgb, var(--accent) 12%, transparent)" iconColor="var(--accent)"
        label="Get notified inside Chillverse" sub="In-app notification center and toasts"
        on={inApp.value} onToggle={() => inApp.save(!inApp.value)}
      />
      <ErrorLine>{inApp.error}</ErrorLine>

      <ToggleRow
        icon={<Monitor size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="var(--blue)"
        label="System notifications" sub="Get notified outside Chillverse."
        on={systemOn} onToggle={toggleSystem}
        disabled={pushBusy || pushBlocked || !pushSupported}
      />
      <InfoLine>
        {!pushSupported
          ? 'Not supported in this browser.'
          : pushBlocked
            ? 'Blocked — enable notifications for this site in your browser settings.'
            : 'Delivered on this device even when Chillverse is closed.'}
      </InfoLine>
      <ErrorLine>{systemError}</ErrorLine>

      <ToggleRow
        icon={<MessagesSquare size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="var(--purple)"
        label="Notify me on every new message in global chat"
        on={globalChat.value} onToggle={() => globalChat.save(!globalChat.value)}
      />
      <ErrorLine>{globalChat.error}</ErrorLine>
    </SettingsShell>
  )
}
