// src/lib/onboardingContent.ts
//
// Single source of truth for every page's first-visit onboarding popup.
// Each entry is keyed by `pageKey`, which is also the key written into
// profiles.onboarding_seen (jsonb) once a player dismisses it.
//
// `images` has 1 entry for a plain popup, or 2 entries for a swipeable
// carousel (see PageOnboarding.tsx for carousel behavior).

export interface OnboardingSlide {
  image: string
  text: string
}

export interface OnboardingPageContent {
  pageKey: string
  title: string
  /** First slide's body text (kept separate from `slides` for the common 1-image case) */
  slides: OnboardingSlide[]
}

const BASE = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Onboarding'

export const ONBOARDING_CONTENT: Record<string, OnboardingPageContent> = {
  dashboard: {
    pageKey: 'dashboard',
    title: 'Welcome to Chillverse',
    slides: [
      {
        image: `${BASE}/e0cda9106501f1ad6c3c37ff5c1cbe98.jpg`,
        text:
          'This is your home. Everything you need starts here.\n\n' +
          'Your streak, level, and XP display here.\n\n' +
          'These are the fastest ways to start:\n' +
          '•  Play games\n' +
          '•  Visit the mall\n' +
          '•  Watch movies\n\n' +
          'These are your main destinations:\n' +
          '•  Profile\n' +
          '•  Weekly missions\n' +
          '•  Rank',
      },
    ],
  },

  games: {
    pageKey: 'games',
    title: 'Game page',
    slides: [
      {
        image: `${BASE}/fec00652c32601e5f641ec340973c3c7.jpg`,
        text:
          'Here is where the grind for XP and rank position lives.\n\n' +
          'One thing to remember: the most fun and hardest games cost more sessions than others. ' +
          'For more details, visit session usage.',
      },
    ],
  },

  artifacts: {
    pageKey: 'artifacts',
    title: 'Welcome to Artifacts page',
    slides: [
      {
        image: `${BASE}/c74fcd8e2bb453445dd49bd0ee3c656a.jpg`,
        text:
          "The most fun part about exploration is you don't just explore maps for fun and XP. " +
          'You can get rare items and show them off in your profile for recognition.\n\n' +
          'Although some require the Void plan.',
      },
    ],
  },

  version: {
    pageKey: 'version',
    title: 'Welcome to Version page',
    slides: [
      {
        image: `${BASE}/95ed2471cf7479cb7b5c448e072ece12.jpg`,
        text:
          "Are you still on 1.0 🤦 (broo, there's literally an update coming for v.5 and you still here).\n\n" +
          'Here you upgrade your Chillverse to give you the best it can offer — in-game animations, ' +
          'background effects, effects on profile, name, and more.\n\n' +
          "It's not just cosmetics, trust me.",
      },
    ],
  },

  mall: {
    pageKey: 'mall',
    title: 'Welcome to mall',
    slides: [
      {
        image: `${BASE}/00d02f00d03fbbcb65ba14e97e509491.jpg`,
        text:
          'If it costs diamonds — profile pics, album pics, banner pics, consumables — we have them all. ' +
          'Stop by here every 2 days and check the featured category to see what your mall FYP gives you.',
      },
    ],
  },

  achievements: {
    pageKey: 'achievements',
    title: 'Welcome to achievements',
    slides: [
      {
        image: `${BASE}/19681cc1dd49285f7f94bd4d9bea0c20.jpg`,
        text: 'Here you see your total progress around Chillverse.',
      },
    ],
  },

  ranks: {
    pageKey: 'ranks',
    title: 'Welcome to ranks',
    slides: [
      {
        image: `${BASE}/224d77d4bee3e004c3844c130a8a3220.jpg`,
        text: 'Ready to progress here, no one remains a rookie forever tho...',
      },
      {
        image: `${BASE}/c61272ca187b1fee407aaafa6d9ce7bd.jpg`,
        text: 'Although there is a 30 day monthly reset, but you will be just fine.',
      },
    ],
  },

  settings: {
    pageKey: 'settings',
    title: 'Welcome to settings',
    slides: [
      {
        image: '',
        text: "Uhmm there is nothing really here, just a page to logout, change username, check out some vital information.",
      },
    ],
  },

  chat: {
    pageKey: 'chat',
    title: 'Welcome to CHAT',
    slides: [
      {
        image: `${BASE}/ac50a770bef6d3a9b94eac44e946924f.jpg`,
        text: 'Have that private discussion with your friend or have that open conversation with the entire Chillverse players.',
      },
      {
        image: `${BASE}/b0e2c3fe6d46a3905cdd8054b2e0b933.jpg`,
        text: "Mind what you share and say here, so your account doesn't get flagged and banned.",
      },
    ],
  },

  weekly_missions: {
    pageKey: 'weekly_missions',
    title: 'Welcome to weekly missions',
    slides: [
      {
        image: `${BASE}/ff178ea65f5ba64cc52d5b6ae36081ad.jpg`,
        text:
          '"Achievements too long to achieve, I need urgent XP." We got you covered. ' +
          'Weekly missions are here to give you that quick XP and little tasks to do.',
      },
    ],
  },

  watch: {
    pageKey: 'watch',
    title: 'Welcome to movies',
    slides: [
      {
        image: `${BASE}/d2d44df334e03826b895a5127d6059e3.jpg`,
        text:
          "Official movie section dedicated to you — cmon, what are you looking for again? " +
          "Content drawn from various channels on YouTube and more, so you don't have to stress all the way there.",
      },
    ],
  },

  profile: {
    pageKey: 'profile',
    title: 'Welcome to Your profile',
    slides: [
      {
        image: `${BASE}/9e8c0193ca0122b46886391790b9bf2c.jpg`,
        text: 'What information do you want other players to get from you? Leave it here.',
      },
      {
        image: `${BASE}/8598e7d7c958157328af0f4c8877bde0.jpg`,
        text: 'Use the challenge button to play fun games with people — just tap challenge on their own profile.',
      },
    ],
  },

  gift: {
    pageKey: 'gift',
    title: 'Welcome to Gift',
    slides: [
      {
        image: `${BASE}/0a5af88aa98f57585abbc7f8660f2a56.jpg`,
        text:
          "Let's show that generosity together — gift a player from this page. " +
          'Tap the gift, input their name, or just tap your friend\u2019s wishlist on their profile and tap the item.',
      },
    ],
  },
}
