// src/features/notifications/push.ts
//
// Client-side Web Push subscription flow. Called once per session right
// after a user signs in (see the onAuthStateChange hook in src/app/App.tsx).
//
// Pipeline this feeds into:
//   subscribeToPush() → browser Push subscription → saved to
//   public.push_subscriptions → a DB trigger on public.notifications
//   calls the `send-push` edge function → real device notification,
//   for every event that already creates an in-app notification today.

import { supabase } from '../../shared/lib/supabase'

// Public VAPID key — safe to ship in client code, this is the public
// half of the keypair. The private key lives only in the send-push
// edge function's secrets and is never exposed here.
const VAPID_PUBLIC_KEY =
  'BEWyVPhwtS2Hbr3rDf0j63YtZi4Qvm0s07Xy8ZjMwiZevsW68PAOIzTIs3d8Ug6HNvmNaLP6TP84bFSZamzg5KY'

/** True if this browser can register a service worker and receive push. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Converts the VAPID public key from base64url into the Uint8Array
 *  shape the Push API's applicationServerKey option requires. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/** Registers public/sw.js if it isn't already, and waits until it's ready. */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js')
}

/**
 * Requests notification permission (if not already decided) and, if
 * granted, subscribes this device to push and saves the subscription
 * to Supabase so the send-push edge function can reach it.
 *
 * Safe to call on every login: no-ops quietly on unsupported browsers
 * (e.g. iOS Safari outside a home-screen PWA) and never throws, so it
 * can never block the sign-in flow it's called from.
 */
export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) return

  try {
    if (Notification.permission === 'denied') return

    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()

    if (permission !== 'granted') return

    const registration = await registerServiceWorker()

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast to BufferSource: TypeScript's typed-array generics for
        // Uint8Array have shifted across lib.dom versions (plain
        // Uint8Array vs Uint8Array<ArrayBuffer>), so this keeps the
        // call compiling regardless of the project's pinned TS/lib.dom.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
    }

    const json = subscription.toJSON()
    const p256dh = json.keys?.p256dh
    const auth = json.keys?.auth
    if (!p256dh || !auth) return

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'user_id,endpoint' },
    )

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[push] failed to save subscription:', error.message)
    }
  } catch (err) {
    // Never let a push-setup failure disrupt login/signup.
    // eslint-disable-next-line no-console
    console.error('[push] subscribeToPush failed:', err)
  }
}

/** Unsubscribes this device from push and removes it from Supabase.
 *  Wire this into a notification-settings toggle if/when one is added. */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return

  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return

    const endpoint = subscription.endpoint
    await subscription.unsubscribe()

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[push] unsubscribeFromPush failed:', err)
  }
}
