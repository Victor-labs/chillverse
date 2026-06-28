// src/lib/haloFallback.ts
import type { HaloPlayerContext } from '../types/halo'

/**
 * Synchronous, never-throwing keyword-match fallback for Halo AI.
 * Used whenever the Gemini API key is missing or any API call fails,
 * so the assistant always has something useful to say.
 */
export function haloFallback(userMessage: string, ctx: HaloPlayerContext): string {
  const msg = userMessage.toLowerCase()

  if (msg.includes('rank') || msg.includes('level')) {
    return `You're at ${ctx.rankEmoji} ${ctx.rankName} with ${ctx.xp} XP. Keep grinding — the next rank is closer than you think!`
  }

  if (msg.includes('streak')) {
    return `You're on a ${ctx.streakDays}-day streak! Don't break the chain 🔥`
  }

  if (msg.includes('sessions') || msg.includes('plays') || msg.includes('today')) {
    return `You've used ${ctx.sessionsToday}/15 sessions today. Sessions reset every 6 hours.`
  }

  if (msg.includes('wishlist')) {
    return ctx.wishlistItems.length > 0
      ? `You've got ${ctx.wishlistItems.length} items wishlisted: ${ctx.wishlistItems.join(', ')}. Grind those diamonds!`
      : 'Your wishlist is empty — head to the Mall to add items!'
  }

  if (msg.includes('diamonds') || msg.includes('currency') || msg.includes('buy')) {
    return "Diamonds are Chillverse's premium currency. Pick them up on the Buy Diamonds page."
  }

  if (msg.includes('tip') || msg.includes('tips') || msg.includes('help') || msg.includes('advice')) {
    return 'My top tip: prioritize games with fewer sessions per play. Tac Zone is free to play — infinite value!'
  }

  if (msg.includes('game') || msg.includes('play') || msg.includes('games')) {
    return ctx.favoriteGame
      ? `Your fave is ${ctx.favoriteGame}! Want strategy tips for it? Just ask.`
      : 'Check out the Games page — Arrow Dash and Pattern Memory are great for XP farming.'
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Hey ${ctx.displayName}! What's up? Ask me anything about Chillverse.`
  }

  return "I'm Halo, your Chillverse companion! Ask me about your rank, games, streak, or the mall."
}
