// src/shared/lib/profileSkins.ts
//
// Void-exclusive profile customization, part 3: whole-page UI skins.
//
// A skin restyles the ENTIRE profile page — background, cards, borders,
// fonts, buttons — for the owner and for anyone viewing them, unlike
// profile_theme_color which only repaints the page background.
//
// ── HOW IT WORKS ──────────────────────────────────────────────────
// Two mechanisms, in order of how much of the work they do:
//
// 1. TEXTURED TOKENS (the main lever). Every profile surface styles
//    itself from the same CSS custom properties the app themes use, and
//    crucially they all write `background: var(--surface)` — the
//    shorthand — never `backgroundColor`. That means --surface can hold a
//    full LAYERED BACKGROUND, not just a flat colour: inked rules, paper
//    fibre, HUD corner brackets, glass sheen. One token, ~56 cards across
//    the three profile screens, no per-component work.
//
//    --bg is the one exception: two call sites use it as `backgroundColor`,
//    so it must stay a plain colour. The page's actual texture is painted
//    by `backdrop` on the root instead.
//
// 2. SCOPED CSS (`PROFILE_SKIN_CSS`) for the handful of things a token
//    can't express: pressed-in letterpress buttons, notched neon buttons,
//    backdrop-filter glass blur, image toning. Scoped under
//    [data-cv-skin] so it cannot leak off a profile page, and marked
//    !important because the components style themselves inline.
//
// Removing a skin restores the app theme exactly — nothing here mutates
// global state.
//
// CAVEAT: a few deep children hardcode literal colours
// (rgba(255,255,255,0.06) etc.) instead of reading a token. Those keep
// their literal value under a skin. Converting them is a separate sweep.

import type { CSSProperties } from 'react'

export type ProfileSkinId = 'storybook' | 'cyberpunk' | 'modern'

export interface ProfileSkinDef {
  id: ProfileSkinId
  label: string
  blurb: string
  vars: Record<string, string>
  /** Page-level background. Carries the texture --bg can't (it must stay a colour). */
  backdrop: string
  font: string
  /** Decorative layer painted over the page; pointer-events:none. */
  overlay?: CSSProperties
}

// ── Storybook ───────────────────────────────────────────────────────
// Every card is a page plate: a double ink rule ruled inside the border,
// foxing blooms, and laid-paper fibre running at a slight angle.
const PAPER_SURFACE = [
  // Inset ink rule, drawn as four hairlines 5px in from each edge.
  'linear-gradient(rgba(112,78,42,.34) 0 100%) 5px 5px/calc(100% - 10px) 1px no-repeat',
  'linear-gradient(rgba(112,78,42,.34) 0 100%) 5px calc(100% - 6px)/calc(100% - 10px) 1px no-repeat',
  'linear-gradient(rgba(112,78,42,.34) 0 100%) 5px 5px/1px calc(100% - 10px) no-repeat',
  'linear-gradient(rgba(112,78,42,.34) 0 100%) calc(100% - 6px) 5px/1px calc(100% - 10px) no-repeat',
  // Foxing / age blooms.
  'radial-gradient(circle at 17% 19%, rgba(150,110,58,.11), transparent 42%)',
  'radial-gradient(circle at 85% 78%, rgba(150,110,58,.10), transparent 44%)',
  // Laid-paper fibre.
  'repeating-linear-gradient(96deg, rgba(120,86,46,.05) 0 2px, transparent 2px 6px)',
  // Warm sheet wash.
  'linear-gradient(#faf3e1, #ecdec0)',
  '#f2e8cf',
].join(',')

// ── Cyberpunk ───────────────────────────────────────────────────────
// Every card is a HUD panel: bracket ticks at opposing corners, a hazard
// stripe tab, and a faint emitter glow bleeding down from the top edge.
const HUD_SURFACE = [
  'linear-gradient(#39ff6e 0 100%) 0 0/15px 2px no-repeat',
  'linear-gradient(#39ff6e 0 100%) 0 0/2px 15px no-repeat',
  'linear-gradient(#39ff6e 0 100%) 100% 100%/15px 2px no-repeat',
  'linear-gradient(#39ff6e 0 100%) 100% 100%/2px 15px no-repeat',
  'repeating-linear-gradient(45deg, rgba(57,255,110,.6) 0 3px, transparent 3px 7px) calc(100% - 20px) 0/17px 5px no-repeat',
  'radial-gradient(ellipse at 50% 0%, rgba(57,255,110,.11), transparent 62%)',
  'linear-gradient(#0c1a14, #060f0b)',
  '#08130e',
].join(',')

// ── Modern ──────────────────────────────────────────────────────────
// Every card is a pane of frosted glass: a bright specular line along the
// top edge, then a diagonal translucent wash. The blur itself is a
// backdrop-filter, applied in CSS below.
const GLASS_SURFACE = [
  'linear-gradient(rgba(255,255,255,.65) 0 100%) 0 0/100% 1px no-repeat',
  'linear-gradient(155deg, rgba(255,255,255,.34), rgba(255,255,255,.12) 46%, rgba(255,255,255,.2))',
  'rgba(255,255,255,.14)',
].join(',')

export const PROFILE_SKINS: ProfileSkinDef[] = [
  {
    id: 'storybook',
    label: 'Storybook',
    blurb: 'Real paper — ruled plates, foxed edges and buttons that press in.',
    font: "'IM Fell English', 'Playfair Display', Georgia, serif",
    backdrop: [
      // Binding shadow down the left edge, so the page reads as bound.
      'linear-gradient(90deg, rgba(74,48,24,.42) 0, rgba(74,48,24,.10) 16px, transparent 46px)',
      'radial-gradient(ellipse at 50% -12%, rgba(255,250,232,.6), transparent 62%)',
      'radial-gradient(ellipse at 50% 108%, rgba(74,48,24,.26), transparent 58%)',
      '#ded0ac',
    ].join(','),
    vars: {
      '--bg': '#ded0ac',
      '--bg-image': 'none',
      '--nav': '#d3c39c',
      '--surface': PAPER_SURFACE,
      '--surface2': PAPER_SURFACE,
      '--surface3': 'linear-gradient(#eee0bf,#ddcba1),#e5d6b2',
      '--active': '#d9c69b',
      '--popover': 'linear-gradient(#faf3e1,#efe3c8),#f5ecd8',
      '--text': '#2f2114',
      '--text-secondary': '#5b4630',
      '--text-dim': '#5b4630',
      '--text-muted': '#87704f',
      '--border': 'rgba(88,60,30,0.38)',
      '--border-strong': 'rgba(88,60,30,0.62)',
      '--sh': 'rgba(84,58,32,0.30)',
      '--sh-strong': 'rgba(84,58,32,0.48)',
      '--hl': 'rgba(255,250,232,0.6)',
      '--hl-faint': 'rgba(255,250,232,0.3)',
      '--glow': 'transparent',
      '--accent': '#8a2f1c',
      '--accent2': '#b56a28',
      '--accent-soft': 'rgba(138,47,28,0.15)',
      '--overlay-scrim': 'rgba(48,32,16,0.58)',
      '--radius': '5px',
      '--radius-sm': '4px',
      '--radius-xs': '2px',
    },
    overlay: {
      backgroundImage: [
        'repeating-linear-gradient(0deg, rgba(84,58,32,.04) 0 1px, transparent 1px 3px)',
        'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(74,48,24,.22))',
      ].join(','),
      mixBlendMode: 'multiply',
    },
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    blurb: 'Terminal green HUD — bracket corners, hazard tabs, live scanlines.',
    font: "'Chakra Petch', 'Orbitron', ui-monospace, monospace",
    backdrop: [
      'radial-gradient(circle at 14% 6%, rgba(57,255,110,.14), transparent 44%)',
      'radial-gradient(circle at 88% 88%, rgba(0,229,255,.12), transparent 46%)',
      'repeating-linear-gradient(0deg, rgba(57,255,110,.05) 0 1px, transparent 1px 44px)',
      'repeating-linear-gradient(90deg, rgba(57,255,110,.05) 0 1px, transparent 1px 44px)',
      '#03080a',
    ].join(','),
    vars: {
      '--bg': '#03080a',
      '--bg-image': 'none',
      '--nav': '#050d0a',
      '--surface': HUD_SURFACE,
      '--surface2': HUD_SURFACE,
      '--surface3': 'linear-gradient(#122a1f,#0b1a13),#0f2118',
      '--active': '#163324',
      '--popover': 'linear-gradient(#0d1c15,#071009),#0a1710',
      '--text': '#d8ffe6',
      '--text-secondary': '#66b585',
      '--text-dim': '#66b585',
      '--text-muted': '#4a8763',
      '--border': 'rgba(57,255,110,0.34)',
      '--border-strong': 'rgba(57,255,110,0.72)',
      '--sh': 'rgba(57,255,110,0.22)',
      '--sh-strong': 'rgba(57,255,110,0.4)',
      '--hl': 'rgba(57,255,110,0.1)',
      '--hl-faint': 'rgba(57,255,110,0.05)',
      '--glow': 'rgba(57,255,110,0.55)',
      '--accent': '#39ff6e',
      '--accent2': '#00e5ff',
      '--accent-soft': 'rgba(57,255,110,0.16)',
      '--overlay-scrim': 'rgba(1,6,4,0.8)',
      '--radius': '0px',
      '--radius-sm': '0px',
      '--radius-xs': '0px',
    },
    overlay: {
      backgroundImage: [
        'repeating-linear-gradient(0deg, rgba(57,255,110,.07) 0 1px, transparent 1px 3px)',
        'radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(0,0,0,.6))',
      ].join(','),
    },
  },
  {
    id: 'modern',
    label: 'Modern Tech',
    blurb: 'Liquid glass — frosted translucent panes over a live colour mesh.',
    font: "'Poppins', 'Inter', sans-serif",
    backdrop: [
      'radial-gradient(at 12% 6%, rgba(146,196,255,.95) 0, transparent 52%)',
      'radial-gradient(at 86% 14%, rgba(186,164,255,.9) 0, transparent 48%)',
      'radial-gradient(at 74% 86%, rgba(94,220,232,.85) 0, transparent 52%)',
      'radial-gradient(at 16% 94%, rgba(58,92,232,.95) 0, transparent 54%)',
      'linear-gradient(158deg,#4f7bf4,#2a49d4)',
    ].join(','),
    vars: {
      '--bg': '#3a5ce4',
      '--bg-image': 'none',
      '--nav': 'rgba(255,255,255,.12)',
      '--surface': GLASS_SURFACE,
      '--surface2': GLASS_SURFACE,
      '--surface3': 'linear-gradient(155deg, rgba(255,255,255,.34), rgba(255,255,255,.14)),rgba(255,255,255,.16)',
      '--active': 'rgba(255,255,255,.26)',
      '--popover': 'linear-gradient(155deg, rgba(255,255,255,.3), rgba(255,255,255,.16)),rgba(70,110,220,.6)',
      '--text': '#ffffff',
      '--text-secondary': 'rgba(255,255,255,0.82)',
      '--text-dim': 'rgba(255,255,255,0.82)',
      '--text-muted': 'rgba(255,255,255,0.62)',
      '--border': 'rgba(255,255,255,0.32)',
      '--border-strong': 'rgba(255,255,255,0.55)',
      '--sh': 'rgba(12,30,90,0.35)',
      '--sh-strong': 'rgba(12,30,90,0.5)',
      '--hl': 'rgba(255,255,255,0.22)',
      '--hl-faint': 'rgba(255,255,255,0.1)',
      '--glow': 'rgba(255,255,255,0.35)',
      '--accent': '#6ea8ff',
      '--accent2': '#b39dff',
      '--accent-soft': 'rgba(255,255,255,0.2)',
      '--overlay-scrim': 'rgba(14,30,80,0.55)',
      '--radius': '24px',
      '--radius-sm': '18px',
      '--radius-xs': '13px',
    },
    overlay: {
      backgroundImage: 'radial-gradient(ellipse at 50% 40%, transparent 58%, rgba(12,30,90,.28))',
    },
  },
]

/**
 * Scoped CSS for the things a token can't express. Injected once by
 * <ProfileSkinStyles/>. Everything is under [data-cv-skin] so it cannot
 * affect any screen outside a profile page, and !important because the
 * profile components style themselves inline.
 *
 * [style*="--surface"] targets exactly the elements that opted into the
 * surface token — i.e. the cards — without needing a class on each one.
 */
export const PROFILE_SKIN_CSS = `
/* Buttons are re-materialised with a plain element selector, not a class:
   only 2 of the profile's buttons use .btn-primary, the rest are
   inline-styled <button>s. Only paint properties are set here — never
   padding, size or layout — so a restyled button keeps its exact box and
   nothing can reflow. */

/* ── Storybook: everything is a pressed paper key ── */
[data-cv-skin="storybook"] button {
  background: linear-gradient(#f9f2df,#e5d5ad) !important;
  color: #46301a !important;
  border: 1px solid rgba(109,75,41,.55) !important;
  border-radius: 4px !important;
  text-shadow: 0 1px 0 rgba(255,255,255,.6);
  box-shadow: inset 0 1px 0 rgba(255,251,238,.95), 1px 2px 0 rgba(84,58,32,.3) !important;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
[data-cv-skin="storybook"] button:active {
  transform: translate(1px,2px);
  box-shadow: inset 0 1px 0 rgba(255,251,238,.95) !important;
}
[data-cv-skin="storybook"] button.btn-primary {
  background: linear-gradient(#8f3a22,#6f2714) !important;
  color: #fdf3dd !important;
  border: 1px solid #55210f !important;
  text-shadow: 0 1px 0 rgba(0,0,0,.35);
  box-shadow: inset 0 1px 0 rgba(255,200,160,.35), 2px 3px 0 rgba(84,58,32,.4) !important;
}
[data-cv-skin="storybook"] button svg { color: #5b4028; }
[data-cv-skin="storybook"] button.btn-primary svg { color: #fdf3dd; }
[data-cv-skin="storybook"] [style*="--surface"] {
  box-shadow: 1px 1px 0 rgba(84,58,32,.10), 4px 7px 16px -7px rgba(84,58,32,.6) !important;
}
[data-cv-skin="storybook"] img { filter: sepia(.34) saturate(.8) contrast(.95); }
[data-cv-skin="storybook"] ::selection { background: rgba(138,47,28,.24); color: #2f2114; }

/* ── Cyberpunk: notched HUD keys ── */
[data-cv-skin="cyberpunk"] button {
  background: linear-gradient(#123024,#0a1a12) !important;
  color: #9dffc4 !important;
  border: 1px solid rgba(57,255,110,.45) !important;
  border-radius: 0 !important;
  letter-spacing: .08em;
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
  box-shadow: inset 0 0 14px rgba(57,255,110,.12) !important;
  transition: box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
[data-cv-skin="cyberpunk"] button:active { transform: translateY(1px); }
[data-cv-skin="cyberpunk"] button.btn-primary {
  background: linear-gradient(90deg,#39ff6e,#00e5ff) !important;
  color: #021a0c !important;
  border: none !important;
  font-weight: 800 !important;
  letter-spacing: .14em;
  text-transform: uppercase;
  box-shadow: 0 0 20px rgba(57,255,110,.5) !important;
}
[data-cv-skin="cyberpunk"] button svg { color: #39ff6e; }
[data-cv-skin="cyberpunk"] button.btn-primary svg { color: #021a0c; }
[data-cv-skin="cyberpunk"] [style*="--surface"] {
  border-radius: 0 !important;
  box-shadow: 0 0 0 1px rgba(57,255,110,.14), inset 0 0 26px rgba(57,255,110,.05) !important;
}
[data-cv-skin="cyberpunk"] img { filter: saturate(1.15) contrast(1.08); }
[data-cv-skin="cyberpunk"] ::selection { background: #39ff6e; color: #03080a; }

/* ── Modern: frosted glass pills ── */
[data-cv-skin="modern"] button {
  background: linear-gradient(155deg, rgba(255,255,255,.34), rgba(255,255,255,.16)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255,255,255,.4) !important;
  border-radius: 999px !important;
  backdrop-filter: blur(14px) saturate(1.5);
  -webkit-backdrop-filter: blur(14px) saturate(1.5);
  box-shadow: 0 6px 18px -8px rgba(8,24,80,.5), inset 0 1px 0 rgba(255,255,255,.45) !important;
  transition: transform var(--dur-fast) var(--ease-out);
}
[data-cv-skin="modern"] button:active { transform: scale(.97); }
[data-cv-skin="modern"] button.btn-primary {
  background: rgba(255,255,255,.95) !important;
  color: #23408f !important;
  border: none !important;
  box-shadow: 0 10px 26px -10px rgba(8,24,80,.6) !important;
}
[data-cv-skin="modern"] button svg { color: #ffffff; }
[data-cv-skin="modern"] button.btn-primary svg { color: #23408f; }
[data-cv-skin="modern"] [style*="--surface"] {
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: 0 10px 30px -12px rgba(8,24,80,.55), inset 0 1px 0 rgba(255,255,255,.32) !important;
}
[data-cv-skin="modern"] ::selection { background: rgba(255,255,255,.32); color: #fff; }

@media (prefers-reduced-motion: reduce) {
  [data-cv-skin] button { transition: none; }
  [data-cv-skin] button:active { transform: none; }
}
`

export function isValidProfileSkin(value: string | null | undefined): value is ProfileSkinId {
  return !!value && PROFILE_SKINS.some(s => s.id === value)
}

export function getProfileSkin(id: string | null | undefined): ProfileSkinDef | null {
  if (!isValidProfileSkin(id)) return null
  return PROFILE_SKINS.find(s => s.id === id)!
}

/** Value for the `data-cv-skin` attribute that scopes PROFILE_SKIN_CSS. */
export function profileSkinAttr(id: string | null | undefined): ProfileSkinId | undefined {
  return isValidProfileSkin(id) ? id : undefined
}

/**
 * Style for a profile page root under `skinId`. Spread onto the existing
 * root — the custom properties cascade to every descendant that reads a
 * token, so no wrapper element is needed.
 *
 * A skin deliberately overrides profile_theme_color: the two are alternate
 * answers to "what does my page look like", and a skin's palette only
 * holds together against its own backdrop.
 */
export function profileSkinStyle(
  skinId: string | null | undefined,
  fallbackBg: string,
): CSSProperties {
  const skin = getProfileSkin(skinId)
  if (!skin) return { background: fallbackBg }
  return {
    ...skin.vars,
    background: skin.backdrop,
    backgroundAttachment: 'fixed',
    fontFamily: skin.font,
    // The decorative overlay is an absolutely positioned child, so the
    // root has to establish a containing block for it.
    position: 'relative',
  } as CSSProperties
}

/**
 * Same, for surfaces that are their own scroll container (the profile
 * preview sheet). An absolutely positioned overlay there would anchor to
 * the padding box and leave everything below the fold unpainted, so the
 * decoration is folded into the element's own background instead.
 */
export function profileSkinBackground(
  skinId: string | null | undefined,
  fallbackBg: string,
): CSSProperties {
  const skin = getProfileSkin(skinId)
  if (!skin) return { background: fallbackBg }
  return {
    ...skin.vars,
    background: skin.backdrop,
    fontFamily: skin.font,
  } as CSSProperties
}

/** Style for the decorative overlay layer. Render only when a skin is set. */
export function profileSkinOverlayStyle(skinId: string | null | undefined): CSSProperties | null {
  const skin = getProfileSkin(skinId)
  if (!skin?.overlay) return null
  return {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
    ...skin.overlay,
  }
}
