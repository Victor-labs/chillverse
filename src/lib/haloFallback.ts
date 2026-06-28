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
  { matchers: ['tac zone', 'tac_zone'], tip: "Tac Zone tip: it's unlimited and free, so use it to warm up your reflexes and to farm XP once your 15 daily sessions run out." },
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
 * FIX #3: Broadened XP/level keyword matching. Previously `msg.includes('increase')`
 * was required alongside 'xp', so "how do I get xp" / "earn xp" / "farm xp"
 * all fell through to the generic default. Now any XP-intent verb triggers it.
 */
export function haloFallback(userMessage: string, ctx: HaloPlayerContext): string {
  const msg = userMessage.toLowerCase()

  // Specific per-game strategy questions take priority over generic topics
  const gameTip = findGameTip(msg)
  if (gameTip) return gameTip

  // FIX #3: Broadened XP matching — any intent verb now triggers the tip,
  // not just "increase". Catches "how do I get xp", "earn xp", "farm xp", etc.
  if (msg.includes('xp') || msg.includes('experience points')) {
    const hasIntent = msg.includes('get') || msg.includes('earn') || msg.includes('increase') ||
                      msg.includes('farm') || msg.includes('how') || msg.includes('more') ||
                      msg.includes('boost') || msg.includes('stack') || msg.includes('gain')
    if (hasIntent) {
      return `Fastest way to stack XP: play games that match your skill for higher scores, grind Tac Zone (unlimited, free) once your sessions run low, keep your ${ctx.streakDays}-day streak alive for the bonus, and clear your Weekly Missions for extra XP.`
    }
    return `You're at ${ctx.rankEmoji} ${ctx.rankName} with ${ctx.xp.toLocaleString()} XP (Level ${ctx.level}).`
  }

  if (msg.includes('rank') || msg.includes('level')) {
    return `You're at ${ctx.rankEmoji} ${ctx.rankName} with ${ctx.xp.toLocaleString()} XP (Level ${ctx.level}). Keep grinding — the next rank is closer than you think!`
  }

  if (msg.includes('streak')) {
    return `You're on a ${ctx.streakDays}-day streak! Don't break the chain 🔥 Streaks add an XP bonus on top of normal gameplay.`
  }

  if (msg.includes('mission')) {
    return 'Weekly Missions refresh every week and reward bonus XP, diamonds, or boosters for hitting specific in-game goals — check the Weekly Missions page so you never leave free rewards on the table.'
  }

  if (msg.includes('sessions') || msg.includes('plays') || msg.includes('today')) {
    return `You've used ${ctx.sessionsToday}/15 sessions today. Sessions reset every 6 hours, but Tac Zone is unlimited if you want to keep playing for free.`
  }

  if (msg.includes('wishlist')) {
    return ctx.wishlistItems.length > 0
      ? `You've got ${ctx.wishlistItems.length} items wishlisted: ${ctx.wishlistItems.join(', ')}. Grind those diamonds!`
      : 'Your wishlist is empty — head to the Mall to add items!'
  }

  if (msg.includes('diamonds') || msg.includes('currency') || msg.includes('buy')) {
    return 'Diamonds are Chillverse\'s premium currency, spent in the Mall on cosmetics. Earn them through missions and events, or pick some up on the Buy Diamonds page.'
  }

  if (msg.includes('tip') || msg.includes('tips') || msg.includes('help') || msg.includes('advice') || msg.includes('efficient') || msg.includes('improve') || msg.includes('better')) {
    return 'My top tip: prioritize games with fewer sessions per play to stretch your daily 15. Tac Zone is free to play — infinite value! Ask me about a specific game for a deeper strategy tip.'
  }

  if (msg.includes('game') || msg.includes('play') || msg.includes('games')) {
    const favMeta = ctx.favoriteGame ? getGameMeta(ctx.favoriteGame) : undefined
    return favMeta
      ? `Your fave is ${favMeta.name}! Want strategy tips for it? Just ask.`
      : `Check out the Games page — ${GAMES[0].name} and ${GAMES[1].name} are great for XP farming.`
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Hey ${ctx.displayName}! What's up? Ask me anything about Chillverse.`
  }

  return "I'm Halo, your Chillverse companion! Ask me about your rank, XP, a specific game's strategy, your streak, missions, or the mall."
}
