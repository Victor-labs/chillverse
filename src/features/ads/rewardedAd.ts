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

// ── Change this to 'adsense' once Google's rewarded web ads are approved ──
export const AD_PROVIDER: AdProvider = 'adsterra'

/**
 * Shows a rewarded ad. Resolves `true` only if the user watched it to
 * completion; resolves `false` if they closed it early, it failed to load,
 * or the network isn't configured yet. Never throws.
 *
 * `onTick(secondsRemaining)` fires roughly once a second while the ad is
 * playing/dwelling, so callers can render a live countdown.
 */
export async function showRewardedAd(onTick?: (secondsRemaining: number) => void): Promise<boolean> {
  switch (AD_PROVIDER) {
    case 'test':
      return showTestAd(onTick)
    case 'adsterra':
      return showAdsterraAd(onTick)
    case 'adsense':
      return showAdSenseAd()
    default:
      return false
  }
}

// ── Test provider: simulated ad, no network involved ────────────────────────
const TEST_AD_SECONDS = 5
function showTestAd(onTick?: (secondsRemaining: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    let remaining = TEST_AD_SECONDS
    onTick?.(remaining)
    const interval = setInterval(() => {
      remaining -= 1
      onTick?.(Math.max(remaining, 0))
      if (remaining <= 0) {
        clearInterval(interval)
        resolve(true)
      }
    }, 1000)
  })
}

// ── Adsterra rewarded ad ─────────────────────────────────────────────────────
//
// IMPORTANT CAVEAT: Adsterra's Social Bar format (the code your account
// currently has) is a passive floating widget — it has no "ad watched"
// completion callback the way real rewarded-video SDKs do. So this can't
// verify the ad was actually watched, only that it was loaded and the tab
// stayed open/focused for a minimum dwell time. Combined with the daily cap
// in start-ad-reward, this keeps abuse low, but it's not as strong as a true
// rewarded-video postback. Swap to 'adsense' once Ad Manager's real rewarded
// web-ad format is approved — that one does have a genuine completion event.

const ADSTERRA_SCRIPT_SRC =
  'https://pl30628300.effectivecpmnetwork.com/50/ae/68/50ae687a2b049c8ad84e2724583a86ec.js'
const ADSTERRA_DWELL_SECONDS = 20 // minimum time the ad must stay visible

let adsterraScriptLoaded = false

function loadAdsterraScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (adsterraScriptLoaded) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = ADSTERRA_SCRIPT_SRC
    script.async = true
    script.onload = () => {
      adsterraScriptLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Adsterra script'))
    document.body.appendChild(script)
  })
}

function showAdsterraAd(onTick?: (secondsRemaining: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    loadAdsterraScript()
      .then(() => {
        // Only counts dwell time while the tab is actually visible/focused —
        // switching away resets the clock, so backgrounding the tab can't be
        // used to farm the reward without watching anything.
        let elapsed = 0
        const tick = 1000
        onTick?.(ADSTERRA_DWELL_SECONDS)
        const interval = setInterval(() => {
          if (document.visibilityState === 'visible') {
            elapsed += tick
          }
          const remaining = Math.max(ADSTERRA_DWELL_SECONDS - Math.floor(elapsed / 1000), 0)
          onTick?.(remaining)
          if (elapsed >= ADSTERRA_DWELL_SECONDS * 1000) {
            clearInterval(interval)
            resolve(true)
          }
        }, tick)
      })
      .catch((err) => {
        console.error('Adsterra ad failed to load:', err)
        resolve(false)
      })
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
