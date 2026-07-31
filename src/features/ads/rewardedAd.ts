// src/features/ads/rewardedAd.ts
//
// Thin wrapper around whichever rewarded-ad network is actually approved
// and live. Neither AdSense rewarded (needs Ad Manager + rewarded-format
// access) nor Adsterra is fully wired up yet, so this ships with:
//
//   - 'test'      — a 5s simulated ad (no network call). Lets you build and
//                    verify the whole Orbs pipeline today.
//   - 'adsterra'  — stub with the two lines you fill in once your Adsterra
//                    zone is approved (see TODO below).
//   - 'adsense'   — stub for Google Ad Manager rewarded web ads, once that
//                    access is granted (see TODO below).
//
// Switch providers by changing AD_PROVIDER below — nothing else in the app
// needs to change, since callers only ever see showRewardedAd().

export type AdProvider = 'test' | 'adsterra' | 'adsense'

// ── Change this to 'adsterra' or 'adsense' once one of them is live ────────
export const AD_PROVIDER: AdProvider = 'test'

/**
 * Shows a rewarded ad. Resolves `true` only if the user watched it to
 * completion; resolves `false` if they closed it early, it failed to load,
 * or the network isn't configured yet. Never throws.
 */
export async function showRewardedAd(): Promise<boolean> {
  switch (AD_PROVIDER) {
    case 'test':
      return showTestAd()
    case 'adsterra':
      return showAdsterraAd()
    case 'adsense':
      return showAdSenseAd()
    default:
      return false
  }
}

// ── Test provider: simulated ad, no network involved ────────────────────────
function showTestAd(): Promise<boolean> {
  return new Promise((resolve) => {
    // The actual UI countdown lives in WatchAdModal.tsx; this just mirrors
    // a real SDK's timing so swapping providers later needs no logic change.
    setTimeout(() => resolve(true), 5000)
  })
}

// ── Adsterra rewarded ad ─────────────────────────────────────────────────────
function showAdsterraAd(): Promise<boolean> {
  return new Promise((resolve) => {
    // TODO once your Adsterra "Rewarded" zone is approved:
    // 1. Add your zone's loader script in index.html (Adsterra gives you a
    //    <script> snippet with your zone id when you create the ad unit).
    // 2. Adsterra exposes a global trigger function for rewarded zones,
    //    e.g. window.showAdsterraRewarded?.({ onComplete, onClose, onError }).
    //    Replace the block below with that call — exact global name/shape
    //    is given in Adsterra's rewarded integration docs for your zone.
    //
    // Example shape (adjust to what Adsterra's dashboard gives you):
    //
    // const w = window as any
    // if (typeof w.showAdsterraRewarded !== 'function') {
    //   console.error('Adsterra rewarded script not loaded')
    //   resolve(false)
    //   return
    // }
    // w.showAdsterraRewarded({
    //   onComplete: () => resolve(true),
    //   onClose: () => resolve(false),
    //   onError: () => resolve(false),
    // })

    console.warn('Adsterra rewarded ad not yet configured — see TODO in rewardedAd.ts')
    resolve(false)
  })
}

// ── Google Ad Manager rewarded web ad ───────────────────────────────────────
function showAdSenseAd(): Promise<boolean> {
  return new Promise((resolve) => {
    // TODO once you have Ad Manager + rewarded ad-unit access:
    // Google's rewarded web ads load via the IMA SDK / googletag rewarded
    // slot API. You'll get a specific ad unit path from Ad Manager; the
    // typical shape is something like:
    //
    // googletag.cmd.push(() => {
    //   const slot = googletag.defineOutOfPageSlot(
    //     '/<network-code>/<ad-unit-path>',
    //     googletag.enums.OutOfPageFormat.REWARDED,
    //   )
    //   if (!slot) { resolve(false); return }
    //   slot.addService(googletag.pubads())
    //   googletag.pubads().addEventListener('rewardedSlotReady', (event: any) => {
    //     event.makeRewardedVisible()
    //   })
    //   googletag.pubads().addEventListener('rewardedSlotGranted', () => resolve(true))
    //   googletag.pubads().addEventListener('rewardedSlotClosed', () => resolve(false))
    //   googletag.display(slot)
    // })

    console.warn('AdSense rewarded ad not yet configured — see TODO in rewardedAd.ts')
    resolve(false)
  })
}
