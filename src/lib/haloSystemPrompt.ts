// src/lib/haloSystemPrompt.ts
import type { HaloPlayerContext } from '../types/halo'
import { getGameMeta } from './games'
import {
  EXPLORATION_SYSTEM, ARTIFACTS_SYSTEM, GAME_STRATEGY_TIPS,
  GAME_CATALOG, RANK_LADDER, XP_AND_LEVELING, SESSION_SYSTEM,
  ECONOMY, MALL, WEEKLY_MISSIONS, STREAK_SYSTEM, ACHIEVEMENTS,
  WATCH_SYSTEM, GIFT_SYSTEM, VERSION_SYSTEM, SOCIAL,
} from './haloKnowledgeBase'

/**
 * Builds the SLIM Halo AI system prompt — persona definition + player live
 * context + conversational rules (~600 tokens).
 *
 * BUG 2 FIX: Added CONVERSATIONAL RULES block so Gemini knows how to handle
 * greetings, casual chat, and social inputs instead of treating them as
 * unanswered platform questions.
 */
export function buildHaloSystemPrompt(ctx: HaloPlayerContext): string {
  const favMeta  = ctx.favoriteGame ? getGameMeta(ctx.favoriteGame) : undefined
  const favLabel = favMeta ? favMeta.name : ctx.favoriteGame ?? 'not set'

  return (
    `You are Halo — the AI companion built into Chillverse.\n` +
    `Chillverse is a competitive browser-based gaming platform with XP, ranks, missions,\n` +
    `exploration maps, artifacts, a cosmetics Mall, and social features.\n` +
    `Answer like an experienced Chillverse player who knows the user personally.\n` +
    `Never break character. Never answer questions outside of Chillverse.\n` +
    `Keep replies SHORT (1-4 sentences) unless asked to elaborate.\n` +
    `Use the player's name naturally. Use gaming slang where it fits.\n` +
    `NEVER invent features, numbers, or game modes that aren't in your knowledge.\n` +
    `\n` +
    `══════════════════════════════════════════\n` +
    `PLAYER LIVE CONTEXT\n` +
    `══════════════════════════════════════════\n` +
    `Name:           ${ctx.displayName}\n` +
    `Rank:           ${ctx.rankName} ${ctx.rankEmoji}\n` +
    `Level:          ${ctx.level}\n` +
    `Total XP:       ${ctx.xp.toLocaleString()}\n` +
    `Streak:         ${ctx.streakDays} day${ctx.streakDays === 1 ? '' : 's'}\n` +
    `Favorite game:  ${favLabel}\n` +
    `Sessions today: ${ctx.sessionsToday} / ${ctx.sessionsToday >= 15 ? '15 (FULL — suggest Tac Zone)' : '15'}\n` +
    `Wishlist:       ${ctx.wishlistItems.length > 0 ? ctx.wishlistItems.join(', ') : 'none saved'}\n` +
    `\n` +
    `══════════════════════════════════════════\n` +
    `CONVERSATIONAL RULES\n` +
    `══════════════════════════════════════════\n` +
    `- For greetings like "hi", "hello", "hey", "good morning", "sup", "yo", etc: respond warmly ` +
    `and personally. Reference the player's name, rank, and streak. Ask what you can help with.\n` +
    `- For time-of-day greetings (good morning / gm / good night / gn): match the time and add a ` +
    `time-aware opener. Keep it 1-2 sentences.\n` +
    `- For "thanks", "ty", "appreciate it", "thx": respond with a short friendly acknowledgement. ` +
    `Do NOT launch into a platform explanation.\n` +
    `- For "ok", "lol", "cool", "nice", "wow", "haha", "awesome": respond briefly and naturally — ` +
    `stay in the conversation without over-explaining the platform.\n` +
    `- For "bye", "later", "gtg", "peace": send a warm farewell referencing their name. Keep it 1 sentence.\n` +
    `- Match the user's energy: short message → short reply. Long question → more detail.\n`
  )
}

/**
 * Detects the topic of the user's message and returns only the relevant
 * knowledge base section(s).
 *
 * BUG 3 FIX: Greeting/social messages now return specific conversational
 * guidance instead of the generic "maybe this is a question" fallback text,
 * which was causing Gemini to give oddly formal responses to simple hellos.
 */
export function getTopicSections(msg: string): string {
  const m = msg.toLowerCase().trim()
  const sections: string[] = []

  // BUG 3 FIX — Detect greetings/social early and return targeted guidance
  const isGreeting =
    m === 'hi' || m === 'hey' || m === 'hello' || m === 'sup' || m === 'yo' ||
    m === 'ok' || m === 'okay' || m === 'lol' || m === 'haha' || m === 'nice' ||
    m === 'cool' || m === 'wow' || m === 'awesome' || m === 'gm' || m === 'gn' ||
    m.includes('good morning') || m.includes('good evening') ||
    m.includes('good afternoon') || m.includes('good night') ||
    m.includes('thank') || m.includes('thanks') || m.includes('ty') ||
    m.includes('thx') || m.includes('appreciate') ||
    m.includes('wassup') || m.includes("what's up") || m.includes('whats up') ||
    m.includes('bye') || m.includes('goodbye') || m.includes('later') ||
    m.includes('gtg') || m.includes('gotta go') || m.includes('peace') ||
    m.includes('see ya') || m.includes('yo ')

  if (isGreeting) {
    return (
      'The user is greeting you or making casual small talk — NOT asking a platform question. ' +
      'Respond warmly and personally. Reference their name, current rank, and streak naturally. ' +
      'Keep it to 1-2 sentences maximum. ' +
      'For time-based greetings (good morning / gm / gn), add a matching time-aware opener. ' +
      'For thanks/acknowledgements, give a brief warm reply only. ' +
      'End greetings with a natural open invitation like "What can I help you with today?"'
    )
  }

  if (
    m.includes('exploration') || m.includes('explore') ||
    m.includes('chamber') || m.includes('map') || m.includes('energy') ||
    m.includes('verdant') || m.includes('ashfall') ||
    m.includes('tidebound') || m.includes('celestial') ||
    m.includes('greenfields') || m.includes('crystal lake') ||
    m.includes('under world') || m.includes('the void')
  ) {
    sections.push(EXPLORATION_SYSTEM)
  }

  if (
    m.includes('artifact') || m.includes('collect') || m.includes('mythic') ||
    m.includes('relic')
  ) {
    sections.push(ARTIFACTS_SYSTEM)
  }

  if (
    m.includes('game') || m.includes('play') || m.includes('tip') ||
    m.includes('strategy') || m.includes('how to') || m.includes('beat') ||
    m.includes('arrow') || m.includes('trivia') || m.includes('tac zone') ||
    m.includes('hangman') || m.includes('pattern') || m.includes('rapid') ||
    m.includes('speed math') || m.includes('liar') || m.includes('close call') ||
    m.includes('two truths')
  ) {
    sections.push(GAME_CATALOG)
    sections.push(GAME_STRATEGY_TIPS)
  }

  if (
    m.includes('xp') || m.includes('level') || m.includes('experience') ||
    m.includes('earn') || m.includes('grind') || m.includes('farm')
  ) {
    sections.push(XP_AND_LEVELING)
  }

  if (
    m.includes('rank') || m.includes('bronze') || m.includes('silver') ||
    m.includes('gold') || m.includes('platinum') || m.includes('diamond') ||
    m.includes('legend') || m.includes('og')
  ) {
    sections.push(RANK_LADDER)
  }

  if (
    m.includes('session') || m.includes('cooldown') || m.includes('reset') ||
    m.includes('plays') || m.includes('daily')
  ) {
    sections.push(SESSION_SYSTEM)
  }

  if (
    m.includes('streak') || m.includes('login') || m.includes('consecutive') ||
    m.includes('chain')
  ) {
    sections.push(STREAK_SYSTEM)
  }

  if (m.includes('mission') || m.includes('weekly') || m.includes('quest')) {
    sections.push(WEEKLY_MISSIONS)
  }

  if (
    m.includes('diamonds') || m.includes('orb') || m.includes('wallet') ||
    m.includes('currency') || m.includes('buy')
  ) {
    sections.push(ECONOMY)
  }

  if (
    m.includes('mall') || m.includes('shop') || m.includes('item') ||
    m.includes('cosmetic') || m.includes('wishlist') || m.includes('inventory') ||
    m.includes('border') || m.includes('avatar') || m.includes('picture')
  ) {
    sections.push(MALL)
  }

  if (m.includes('gift') || m.includes('send') || m.includes('giving')) {
    sections.push(GIFT_SYSTEM)
  }

  if (
    m.includes('watch') || m.includes('video') || m.includes('stream') ||
    m.includes('movie')
  ) {
    sections.push(WATCH_SYSTEM)
  }

  if (
    m.includes('version') || m.includes('upgrade') || m.includes('premium') ||
    m.includes('v2') || m.includes('v3') || m.includes('v4') || m.includes('v5')
  ) {
    sections.push(VERSION_SYSTEM)
  }

  if (m.includes('achievement') || m.includes('badge') || m.includes('unlock')) {
    sections.push(ACHIEVEMENTS)
  }

  if (
    m.includes('follow') || m.includes('chat') || m.includes('dm') ||
    m.includes('profile') || m.includes('social')
  ) {
    sections.push(SOCIAL)
  }

  if (sections.length === 0) {
    return (
      "If the question is about Chillverse, answer from your general knowledge " +
      "of the platform. If you truly cannot answer, say: \"I'm not sure about " +
      "that specific detail — try asking me about your rank, games, XP, " +
      "missions, or exploration!\""
    )
  }

  return sections.join('\n\n---\n\n')
    }
