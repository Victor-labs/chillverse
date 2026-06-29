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
 * context ONLY (~500 tokens). Topic-specific knowledge is injected dynamically
 * by getTopicSections() in useHaloAI.ts, keeping per-request token usage low.
 */
export function buildHaloSystemPrompt(ctx: HaloPlayerContext): string {
  const favMeta  = ctx.favoriteGame ? getGameMeta(ctx.favoriteGame) : undefined
  const favLabel = favMeta ? favMeta.name : ctx.favoriteGame ?? 'not set'

  return `You are Halo — the AI companion built into Chillverse.
Chillverse is a competitive browser-based gaming platform with XP, ranks, missions,
exploration maps, artifacts, a cosmetics Mall, and social features.
Answer like an experienced Chillverse player who knows the user personally.
Never break character. Never answer questions outside of Chillverse.
Keep replies SHORT (1-4 sentences) unless asked to elaborate.
Use the player's name naturally. Use gaming slang where it fits.
NEVER invent features, numbers, or game modes that aren't in your knowledge.

══════════════════════════════════════════
PLAYER LIVE CONTEXT
══════════════════════════════════════════
Name:           ${ctx.displayName}
Rank:           ${ctx.rankName} ${ctx.rankEmoji}
Level:          ${ctx.level}
Total XP:       ${ctx.xp.toLocaleString()}
Streak:         ${ctx.streakDays} day${ctx.streakDays === 1 ? '' : 's'}
Favorite game:  ${favLabel}
Sessions today: ${ctx.sessionsToday} / ${ctx.sessionsToday >= 15 ? '15 (FULL — suggest Tac Zone)' : '15'}
Wishlist:       ${ctx.wishlistItems.length > 0 ? ctx.wishlistItems.join(', ') : 'none saved'}
`
}

/**
 * Detects the topic of the user's message and returns only the relevant
 * knowledge base section(s). Replaces the full 6,000-token FULL_CHILLVERSE_KNOWLEDGE
 * dump with a targeted 200-800 token inject precise to the question being asked.
 */
export function getTopicSections(msg: string): string {
  const m = msg.toLowerCase()
  const sections: string[] = []

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

  if (
    m.includes('achievement') || m.includes('badge') || m.includes('unlock')
  ) {
    sections.push(ACHIEVEMENTS)
  }

  if (
    m.includes('follow') || m.includes('chat') || m.includes('dm') ||
    m.includes('profile') || m.includes('social')
  ) {
    sections.push(SOCIAL)
  }

  // If no topic detected, return a minimal hint block only
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
