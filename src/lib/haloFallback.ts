// src/lib/haloFallback.ts
import type { HaloPlayerContext } from '../types/halo'
import { GAMES, getGameMeta } from './games'

interface GameTip {
  matchers: string[]
  tip: string
}

// Per-game strategy tips, matched against the user's message so the
// fallback engine can still give concrete game-specific advice even
// without a live Gemini call.
const GAME_TIPS: GameTip[] = [
  { matchers: ['arrow dash', 'arrow_dash', 'arrowdash'], tip: "Arrow Dash tip: react to the arrow's shape, not its color — color is just a distraction. Keep your eyes on the center of the screen so you catch the next prompt instantly." },
  { matchers: ['pattern memory', 'pattern_memory'], tip: 'Pattern Memory tip: chunk the sequence into groups of 3-4 instead of memorizing one long string — say the pattern in your head as you watch it.' },
  { matchers: ['rapid sort', 'rapid_sort'], tip: "Rapid Sort tip: pre-decide your sorting categories before the round starts so you're moving on instinct, not thinking." },
  { matchers: ['tac zone', 'tac_zone'], tip: "Tac Zone tip: it's unlimited and free, so use it to warm up your reflexes and to farm XP once your 15 daily sessions run out. It never costs a session!" },
  { matchers: ['two truths', 'two_truths'], tip: 'Two Truths, One False tip: look for the claim with an oddly specific or oddly vague number — that one is usually the lie.' },
  { matchers: ['speed math', 'speed_math'], tip: "Speed Math tip: solve the easiest equations first across the whole set instead of going in order — banking quick points early kills the time pressure." },
  { matchers: ["liar's grid", 'liars grid', 'liars_grid'], tip: "Liar's Grid tip: scan row by row instead of the whole grid at once — a systematic sweep catches the broken equation faster." },
  { matchers: ['trivia clash', 'trivia_clash'], tip: 'Trivia Clash tip: it costs 6 sessions, so only queue it when you trust the category — grind Tac Zone instead if you just want cheap XP.' },
  { matchers: ['hangman'], tip: 'Hangman tip: guess vowels and common consonants (E, A, R, S, T) first to narrow the word down fast.' },
  { matchers: ['close call', 'close_call'], tip: 'Close Call tip: estimate the range first, then narrow in — guessing exact on the first try wastes time.' },
]

function findGameTip(msg: string): string | null {
  for (const { matchers, tip } of GAME_TIPS) {
    if (matchers.some(m => msg.includes(m))) return tip
  }
  return null
}

/**
 * Synchronous, never-throwing keyword-match fallback for Halo AI.
 * Used whenever the Gemini API key is missing or any API call fails,
 * so the assistant always has something useful and accurate to say.
 *
 * BRANCH PRIORITY ORDER (specific → generic to prevent mis-routing):
 *  1.  Per-game strategy tips (most specific)
 *  2.  Exploration / chambers / maps
 *  3.  Artifacts / collectibles
 *  4.  Streak
 *  5.  Sessions / plays today
 *  6.  Weekly missions
 *  7.  Wishlist
 *  8.  Diamonds / currency / buy
 *  9.  Watch / video
 *  10. Gift / send
 *  11. Version / upgrade
 *  12. Achievements / badges
 *  13. XP / experience (with intent check)
 *  14. Rank / level           ← moved DOWN to avoid false matches
 *  15. Tips / help / advice
 *  16. Game / play (generic)
 *  17. Greeting / hello
 *  18. Default catch-all
 */
export function haloFallback(userMessage: string, ctx: HaloPlayerContext): string {
  const msg = userMessage.toLowerCase()

  // 1. Specific per-game strategy questions take highest priority
  const gameTip = findGameTip(msg)
  if (gameTip) return gameTip

  // 2. Exploration — checked BEFORE generic xp/rank to avoid mis-routing
  if (
    msg.includes('exploration') || msg.includes('explore') ||
    msg.includes('chamber') || msg.includes('map') || msg.includes('energy') ||
    msg.includes('verdant') || msg.includes('ashfall') ||
    msg.includes('tidebound') || msg.includes('celestial') ||
    msg.includes('greenfields') || msg.includes('crystal lake') ||
    msg.includes('under world') || msg.includes('the void')
  ) {
    return (
      "Exploration is Chillverse's idle adventure system — pick a map, " +
      'run timed chambers, and earn XP + Artifacts passively. ' +
      'Start with Verdant Hollow (free, no XP gate), then unlock higher maps ' +
      'as your total XP grows. Higher maps = way more XP per chamber! 🗺️'
    )
  }

  // 3. Artifacts
  if (msg.includes('artifact') || msg.includes('artifacts') || msg.includes('relic') || msg.includes('mythic')) {
    return 'Artifacts are rare collectibles found in Exploration chambers! Each one has a tier (Common → Mythic) and awards bonus XP when you unlock it. Check the Artifacts page to see what you have and what you still need to find. 🏺'
  }

  // 4. Streak
  if (msg.includes('streak') || msg.includes('consecutive') || msg.includes('chain')) {
    return `You're on a ${ctx.streakDays}-day streak! Don't break the chain 🔥 Streaks add an XP bonus on top of normal gameplay — the longer it goes, the better it pays.`
  }

  // 5. Sessions / plays today
  if (msg.includes('session') || msg.includes('plays') || msg.includes('today') || msg.includes('cooldown') || msg.includes('reset')) {
    return `You've used ${ctx.sessionsToday}/15 sessions today. Tac Zone is unlimited if you want to keep playing for free, and sessions reset at midnight or after a 6-hour cooldown. Consider upgrading to v4.0 for 19 sessions/day!`
  }

  // 6. Weekly missions
  if (msg.includes('mission') || msg.includes('weekly') || msg.includes('quest')) {
    return 'Weekly Missions refresh every Monday and reward bonus XP, diamonds, or boosters for hitting specific in-game goals — check the Weekly Missions page so you never leave free rewards on the table! 🎯'
  }

  // 7. Wishlist
  if (msg.includes('wishlist')) {
    return ctx.wishlistItems.length > 0
      ? `You've got ${ctx.wishlistItems.length} item${ctx.wishlistItems.length > 1 ? 's' : ''} wishlisted: ${ctx.wishlistItems.join(', ')}. Grind those diamonds and check the Mall! 💎`
      : 'Your wishlist is empty — head to the Mall and heart any items you want. Saves time when you have diamonds to spend!'
  }

  // 8. Diamonds / currency / buy
  if (msg.includes('diamonds') || msg.includes('orb') || msg.includes('wallet') || msg.includes('currency') || msg.includes('buy')) {
    return "Diamonds are Chillverse's premium currency. Earn them through Weekly Missions or buy them on the Buy Diamonds page. Spend them in the Mall on cosmetics, gift items to friends, or upgrade your Chillverse Version! 💎"
  }

  // 9. Watch / video / stream
  if (msg.includes('watch') || msg.includes('video') || msg.includes('movie') || msg.includes('stream')) {
    return "The Watch section streams curated content — pick Kids 👶 or Adult 🎬 categories. It's open from 5:00 AM to midnight daily and refreshes every 5 hours. Full-screen, no distractions!"
  }

  // 10. Gift / send
  if (msg.includes('gift') || msg.includes('send') || msg.includes('giving')) {
    return 'You can gift any Mall item to another Chillverse player from the Gift page! Just pick the item, search for their username, and the cost in Diamonds comes from your wallet. They get the item instantly + a notification. 🎁'
  }

  // 11. Version / upgrade
  if (msg.includes('version') || msg.includes('upgrade') || msg.includes('premium') || msg.includes('pro') || msg.includes('v2') || msg.includes('v3') || msg.includes('v4') || msg.includes('v5')) {
    return 'Chillverse Versions go from v1.0 (free) to v5.0 (max). Key upgrades: v2.0 (1,900💎) adds animations, v3.0 (3,900💎) adds more games, v4.0 (5,900💎) raises your daily sessions from 15 to 19. All permanent!'
  }

  // 12. Achievements / badges
  if (msg.includes('achievement') || msg.includes('badge') || msg.includes('unlock')) {
    return 'Achievements are milestone rewards you unlock by hitting XP thresholds, winning streaks, or completing special challenges. Check the Achievements page to see which ones you\'re close to and plan your grind! 🏆'
  }

  // 13. XP / experience — checked AFTER specific topics to avoid over-broad matching
  if (msg.includes('xp') || msg.includes('experience') || msg.includes('earn') || msg.includes('grind') || msg.includes('farm')) {
    const hasIntent =
      msg.includes('get') || msg.includes('earn') || msg.includes('increase') ||
      msg.includes('farm') || msg.includes('how') || msg.includes('more') ||
      msg.includes('boost') || msg.includes('stack') || msg.includes('gain')
    if (hasIntent) {
      return `Fastest way to stack XP: play games for score, grind Tac Zone (unlimited + free) when sessions run low, run Exploration chambers for big passive XP, collect Artifacts for bonus XP on top, keep your ${ctx.streakDays}-day streak alive, and clear your Weekly Missions. So many ways to level up! 🔥`
    }
    return `You're at ${ctx.rankEmoji} ${ctx.rankName} with ${ctx.xp.toLocaleString()} XP (Level ${ctx.level}). Keep grinding — every session counts!`
  }

  // 14. Rank / level — checked AFTER specific topics
  if (msg.includes('rank') || msg.includes('level')) {
    return `You're at ${ctx.rankEmoji} ${ctx.rankName} with ${ctx.xp.toLocaleString()} XP (Level ${ctx.level}). Keep grinding — the next rank is closer than you think! 💪`
  }

  // 15. Tips / help / advice
  if (msg.includes('tip') || msg.includes('tips') || msg.includes('help') || msg.includes('advice') || msg.includes('efficient') || msg.includes('improve') || msg.includes('better')) {
    return 'My top tips: use Tac Zone to farm unlimited free XP, run Exploration chambers passively for big XP gains, grind Weekly Missions for diamonds, and keep that streak alive! Ask me about any specific game for deeper strategy. 😊'
  }

  // 16. Game / play (generic)
  if (msg.includes('game') || msg.includes('play') || msg.includes('games')) {
    const favMeta = ctx.favoriteGame ? getGameMeta(ctx.favoriteGame) : undefined
    return favMeta
      ? `Your fave is ${favMeta.name}! Want strategy tips for it? Just ask — I've got detailed advice for every game on Chillverse. 🎮`
      : `Check out the Games page — ${GAMES[0].name} and ${GAMES[1].name} are great for XP farming. And Tac Zone is always free to play! 🎮`
  }

  // 17. Greeting
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('what can you do') || msg.includes('what do you do')) {
    return `Hey ${ctx.displayName}! 👋 I'm Halo, your Chillverse guide. Ask me about your rank, games strategy, missions, exploration, artifacts, gifting, or anything else on the platform — I've got you!`
  }

  // 18. Default catch-all
  return `Hey ${ctx.displayName}! I'm Halo, your Chillverse companion. Ask me about your rank, XP, a game's strategy, weekly missions, exploration, artifacts, gifting — anything Chillverse! 😊`
}
