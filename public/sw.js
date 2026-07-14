// public/sw.js
//
// Service worker for Chillverse Web Push notifications.
// Registered by src/features/notifications/push.ts. Two jobs:
//   1. Receive a `push` event from the browser's push service and show
//      a real OS-level notification using the payload sent by the
//      `send-push` Supabase edge function — but ONLY if the user isn't
//      already looking at an open Chillverse tab, since useNotificationToast.ts
//      already shows an in-app toast for that same event in that case.
//      Showing both for the same event is redundant and spammy.
//   2. Handle the user clicking that notification — focus an existing
//      Chillverse tab if one is open, otherwise open a new one, landing
//      on the URL the notification points to.

self.addEventListener('install', () => {
  // Activate this service worker as soon as it finishes installing,
  // without waiting for old tabs to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Take control of any already-open Chillverse tabs immediately.
  event.waitUntil(self.clients.claim())
})

/**
 * True if the user currently has a Chillverse tab open AND foregrounded
 * (visibilityState === 'visible' on at least one WindowClient). A tab
 * that's open but backgrounded/minimized/behind another window does NOT
 * count as visible, so push still fires in that case — the in-app toast
 * only reaches the user if they're actually looking at the page.
 */
async function hasVisibleChillverseTab() {
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  return clientList.some((client) => client.visibilityState === 'visible')
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    // Not JSON — fall back to a plain-text notification rather than
    // dropping the push silently.
    payload = { title: 'Chillverse', body: event.data.text() }
  }

  event.waitUntil(
    (async () => {
      // If the user is actively looking at Chillverse right now, the
      // Realtime toast (useNotificationToast.ts) has already surfaced
      // this exact notification in-app. Showing the OS banner too would
      // just be a duplicate alert for the same event, so skip it.
      const alreadyVisible = await hasVisibleChillverseTab()
      if (alreadyVisible) return

      const title = payload.title || 'Chillverse'
      const options = {
        body: payload.body || '',
        icon: payload.icon || '/web-app-manifest-192x192.png',
        badge: payload.badge || '/favicon-96x96.png',
        tag: payload.tag || 'chillverse-notification',
        // Renotify so a second event with the same tag still alerts the
        // user (e.g. two chat messages in a row), instead of silently
        // replacing the first without a fresh alert.
        renotify: true,
        data: payload.data || {},
      }

      await self.registration.showNotification(title, options)
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url) || '/notifications'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          const clientUrl = new URL(client.url)
          if (clientUrl.origin === self.location.origin && 'focus' in client) {
            // Reuse an already-open Chillverse tab: focus it and
            // navigate to the relevant page.
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        // No open tab — open a fresh one.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      }),
  )
})
