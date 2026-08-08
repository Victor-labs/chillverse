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

export type ProfileSkinId = 'storybook' | 'cyberpunk' | 'modern' | 'ice' | 'comic'

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

// ── Ice ─────────────────────────────────────────────────────────────
// Every card is a slab of glacier: a rime line frozen along the top,
// crystal striations raking across at 115deg, and a cold blue core.
const ICE_SURFACE = [
  'linear-gradient(rgba(255,255,255,.92) 0 100%) 0 0/100% 2px no-repeat',
  'radial-gradient(circle at 18% 8%, rgba(255,255,255,.6), transparent 46%)',
  'repeating-linear-gradient(115deg, rgba(255,255,255,.17) 0 3px, transparent 3px 12px)',
  'linear-gradient(160deg, #eef6fe, #c6ddf2 58%, #aacce9)',
  '#dcebf8',
].join(',')

// ── Comic ───────────────────────────────────────────────────────────
// Every card is an inked panel: halftone dots over a saturated indigo
// fill, lit from the top-left like a printed cel.
const COMIC_SURFACE = [
  'radial-gradient(rgba(255,255,255,.07) 0 1.1px, transparent 1.2px) 0 0/6px 6px',
  'radial-gradient(circle at 12% 6%, rgba(255,90,190,.16), transparent 52%)',
  'linear-gradient(158deg, #331c6e, #1d1140 62%, #170d33)',
  '#241452',
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
  {
    id: 'ice',
    label: 'Glacier',
    blurb: 'Frozen slabs, crystal keys and a jagged rime edge.',
    font: "'Cinzel', 'Playfair Display', Georgia, serif",
    backdrop: [
      'radial-gradient(ellipse at 50% -8%, rgba(255,255,255,.85), transparent 58%)',
      'radial-gradient(circle at 84% 16%, rgba(180,225,255,.5), transparent 46%)',
      'radial-gradient(circle at 12% 78%, rgba(150,200,240,.45), transparent 50%)',
      'linear-gradient(#bcd9f0, #8fb6da 58%, #6d97c4)',
    ].join(','),
    vars: {
      '--bg': '#a9c9e6',
      '--bg-image': 'none',
      '--nav': '#9dc0e0',
      '--surface': ICE_SURFACE,
      '--surface2': ICE_SURFACE,
      '--surface3': 'linear-gradient(#e3f0fc,#bcd8ef),#d2e6f7',
      '--active': '#c2dcf2',
      '--popover': 'linear-gradient(#f2f9ff,#d7e9f9),#e8f3fd',
      '--text': '#12304f',
      '--text-secondary': '#3d6288',
      '--text-dim': '#3d6288',
      '--text-muted': '#6a8dad',
      '--border': 'rgba(255,255,255,0.75)',
      '--border-strong': 'rgba(120,175,220,0.85)',
      '--sh': 'rgba(30,70,110,0.28)',
      '--sh-strong': 'rgba(30,70,110,0.45)',
      '--hl': 'rgba(255,255,255,0.7)',
      '--hl-faint': 'rgba(255,255,255,0.38)',
      '--glow': 'rgba(160,220,255,0.7)',
      '--accent': '#2b7cc7',
      '--accent2': '#7fd6f7',
      '--accent-soft': 'rgba(43,124,199,0.14)',
      '--overlay-scrim': 'rgba(16,44,74,0.6)',
      '--radius': '6px',
      '--radius-sm': '5px',
      '--radius-xs': '3px',
    },
    overlay: {
      backgroundImage: [
        'radial-gradient(rgba(255,255,255,.5) 0 1px, transparent 1.4px) 0 0/34px 34px',
        'radial-gradient(rgba(255,255,255,.35) 0 1px, transparent 1.4px) 17px 12px/48px 48px',
        'radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(40,80,120,.22))',
      ].join(','),
    },
  },
  {
    id: 'comic',
    label: 'Comic',
    blurb: 'Inked panels on a halftone press — angular, loud, tilted.',
    font: "'Bangers', 'Poppins', Impact, sans-serif",
    backdrop: [
      'radial-gradient(circle at 16% 8%, rgba(255,46,136,.32), transparent 46%)',
      'radial-gradient(circle at 88% 20%, rgba(53,224,255,.24), transparent 44%)',
      'radial-gradient(circle at 70% 92%, rgba(255,150,40,.2), transparent 46%)',
      'repeating-conic-gradient(from 0deg at 50% 30%, rgba(255,255,255,.045) 0 6deg, transparent 6deg 12deg)',
      'linear-gradient(160deg,#241452,#120a2c)',
    ].join(','),
    vars: {
      '--bg': '#160c30',
      '--bg-image': 'none',
      '--nav': '#1c1040',
      '--surface': COMIC_SURFACE,
      '--surface2': COMIC_SURFACE,
      '--surface3': 'linear-gradient(158deg,#43268a,#2a1663),#331b73',
      '--active': '#43268a',
      '--popover': 'linear-gradient(158deg,#331c6e,#1d1140),#271557',
      '--text': '#ffffff',
      '--text-secondary': '#c0aef0',
      '--text-dim': '#c0aef0',
      '--text-muted': '#9384c8',
      '--border': '#0c0620',
      '--border-strong': '#000000',
      '--sh': 'rgba(8,3,24,0.6)',
      '--sh-strong': 'rgba(8,3,24,0.8)',
      '--hl': 'rgba(255,255,255,0.12)',
      '--hl-faint': 'rgba(255,255,255,0.06)',
      '--glow': 'rgba(255,46,136,0.6)',
      '--accent': '#ff2e88',
      '--accent2': '#35e0ff',
      '--accent-soft': 'rgba(255,46,136,0.18)',
      '--overlay-scrim': 'rgba(10,4,28,0.78)',
      '--radius': '4px',
      '--radius-sm': '3px',
      '--radius-xs': '2px',
    },
    overlay: {
      backgroundImage: [
        'radial-gradient(rgba(0,0,0,.22) 0 1.3px, transparent 1.4px) 0 0/5px 5px',
        'radial-gradient(ellipse at 50% 44%, transparent 54%, rgba(6,2,20,.5))',
      ].join(','),
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

/* ══════════════════════════════════════════════════════════════════
   SHELL SHAPE — the silhouette of the profile itself.

   [data-cv-skin] sits on the profile root (full page) and on the
   preview sheet, so these rules reshape the whole thing rather than
   only recolouring inside a stock rounded rectangle. This is the part
   that stops it reading as "a website wearing a texture".
   ══════════════════════════════════════════════════════════════════ */

/* ── Paper: torn top and bottom edges ──
   Two bite patterns at DIFFERENT periods (19px and 27px) so the notches
   never line up into an obvious repeat — a single period reads as a
   scalloped doily, not a tear. */
[data-cv-skin="storybook"] {
  --cv-torn:
    radial-gradient(circle at 50% 100%, transparent 0 5px, #000 5.5px) 0 0/19px 9px repeat-x,
    radial-gradient(circle at 50% 0%,   transparent 0 4px, #000 4.5px) 0 100%/27px 8px repeat-x,
    linear-gradient(#000 0 100%) 0 9px/100% calc(100% - 17px) no-repeat;
  -webkit-mask-image: var(--cv-torn);
          mask-image: var(--cv-torn);
  border-radius: 0 !important;
}

/* ── Cyberpunk: hard rectangle, corners cut, neon rim ── */
[data-cv-skin="cyberpunk"] {
  border-radius: 0 !important;
  clip-path: polygon(
    18px 0, 100% 0,
    100% calc(100% - 18px), calc(100% - 18px) 100%,
    0 100%, 0 18px
  );
  box-shadow:
    inset 0 0 0 1px rgba(57,255,110,.55),
    inset 0 0 26px rgba(57,255,110,.14),
    inset 0 0 90px rgba(0,229,255,.07) !important;
}

/* ── Glass: one generous continuous radius ── */
[data-cv-skin="modern"] {
  border-radius: 30px !important;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.4),
    inset 0 0 0 1px rgba(255,255,255,.18) !important;
}

/* A full-page profile fills the viewport, so a rounded or torn BOTTOM
   would float mid-scroll with nothing under it. Square the page-level
   edges and let the shaping read at the top, where the silhouette is
   actually visible against the banner. */
[data-cv-skin][style*="min-height"] {
  border-radius: 0 !important;
  clip-path: none !important;
}
/* ── Ice: jagged rime edge, frozen rather than torn ──
   Two mirrored 45deg cuts per tile form V-shaped teeth, which reads as
   fractured ice; the paper skin's rounded bites would read as melted. */
[data-cv-skin="ice"] {
  --cv-frost:
    linear-gradient(135deg, transparent 0 7px, #000 7px) 0 0/20px 11px repeat-x,
    linear-gradient(225deg, transparent 0 7px, #000 7px) 10px 0/20px 11px repeat-x,
    linear-gradient(#000 0 100%) 0 11px/100% calc(100% - 22px) no-repeat,
    linear-gradient(45deg,  transparent 0 7px, #000 7px) 0 100%/20px 11px repeat-x,
    linear-gradient(315deg, transparent 0 7px, #000 7px) 10px 100%/20px 11px repeat-x;
  -webkit-mask-image: var(--cv-frost);
          mask-image: var(--cv-frost);
  border-radius: 0 !important;
}
[data-cv-skin="ice"][style*="min-height"] {
  --cv-frost:
    linear-gradient(135deg, transparent 0 7px, #000 7px) 0 0/20px 11px repeat-x,
    linear-gradient(225deg, transparent 0 7px, #000 7px) 10px 0/20px 11px repeat-x,
    linear-gradient(#000 0 100%) 0 11px/100% calc(100% - 11px) no-repeat;
}

/* ── Comic: the panel itself is cut on the diagonal ── */
[data-cv-skin="comic"] {
  border-radius: 0 !important;
  clip-path: polygon(
    0 26px, 30px 0, 100% 0,
    100% calc(100% - 34px), calc(100% - 38px) 100%, 0 100%
  );
}
[data-cv-skin="comic"][style*="min-height"] { clip-path: none !important; }

[data-cv-skin="storybook"][style*="min-height"] {
  --cv-torn:
    radial-gradient(circle at 50% 100%, transparent 0 5px, #000 5.5px) 0 0/19px 9px repeat-x,
    linear-gradient(#000 0 100%) 0 9px/100% calc(100% - 9px) no-repeat;
}

/* Buttons are re-materialised with a plain element selector, not a class:
   only 2 of the profile's buttons use .btn-primary, the rest are
   inline-styled <button>s. Only paint properties are set here — never
   padding, size or layout — so a restyled button keeps its exact box and
   nothing can reflow. */

/* ══════════════════════════════════════════════════════════════════
   STORYBOOK — a physical fantasy-RPG character sheet.

   Everything below is drawn in CSS: no image assets, and no new markup
   beyond four data-cv-part hooks on elements that already existed.
   Pseudo-elements do the ornamental work (corner brackets, brass pins,
   carved scrollwork), which is why cards are forced position:relative.
   ══════════════════════════════════════════════════════════════════ */

/* ── Cards become parchment plates with pinned corners ── */
[data-cv-skin="storybook"] [style*="--surface"] {
  position: relative;
  border-radius: 3px !important;
  box-shadow:
    1px 1px 0 rgba(84,58,32,.10),
    5px 8px 18px -8px rgba(84,58,32,.65),
    inset 0 0 44px rgba(150,110,58,.10) !important;
}
/* Ornamental corner brackets. */
[data-cv-skin="storybook"] [style*="--surface"]::before {
  content: '';
  position: absolute; inset: 3px;
  pointer-events: none; z-index: 2;
  background:
    linear-gradient(rgba(109,75,41,.55) 0 100%) 0 0/11px 1.5px no-repeat,
    linear-gradient(rgba(109,75,41,.55) 0 100%) 0 0/1.5px 11px no-repeat,
    linear-gradient(rgba(109,75,41,.55) 0 100%) 100% 0/11px 1.5px no-repeat,
    linear-gradient(rgba(109,75,41,.55) 0 100%) 100% 0/1.5px 11px no-repeat,
    linear-gradient(rgba(109,75,41,.55) 0 100%) 0 100%/11px 1.5px no-repeat,
    linear-gradient(rgba(109,75,41,.55) 0 100%) 0 100%/1.5px 11px no-repeat,
    linear-gradient(rgba(109,75,41,.55) 0 100%) 100% 100%/11px 1.5px no-repeat,
    linear-gradient(rgba(109,75,41,.55) 0 100%) 100% 100%/1.5px 11px no-repeat;
}

/* ── Banner becomes a carved wooden header board ── */
[data-cv-skin="storybook"] [data-cv-part="banner"] {
  height: 138px !important;
  /* Thick carved surround; the image sits in the content box at full
     strength, so it reads as stamped ONTO wood rather than stained by it. */
  border: 9px solid #6d4526 !important;
  border-bottom-width: 12px !important;
  border-image:
    repeating-linear-gradient(91deg, #7d5029 0 2px, #64401f 2px 8px) 9 / 9px / 0 stretch;
  background: linear-gradient(#8a5a2f, #4a2a12) !important;
  box-shadow:
    inset 0 0 0 2px rgba(40,22,8,.75),
    inset 0 2px 0 rgba(224,182,120,.28),
    0 5px 14px -6px rgba(40,22,8,.7);
}
/* Banner artwork untouched — no tint, no opacity drop. */
[data-cv-skin="storybook"] [data-cv-part="banner"] img,
[data-cv-skin="storybook"] [data-cv-part="banner"] video { filter: none; opacity: 1; }
/* Carved scallop scrollwork along the bottom lip of the board. */
[data-cv-skin="storybook"] [data-cv-part="banner"]::after {
  content: '';
  position: absolute; left: 0; right: 0; bottom: 0; height: 22px;
  pointer-events: none; z-index: 3;
  background:
    radial-gradient(circle at 50% 100%, #8a5a2f 0 46%, transparent 47%) 0 0/40px 22px repeat-x,
    linear-gradient(rgba(214,168,106,.4) 0 100%) 0 100%/100% 2px no-repeat;
}

/* ── Avatar becomes a framed portrait ── */
[data-cv-skin="storybook"] [data-cv-part="portrait"] {
  position: relative;
  border-radius: 4px !important;
  padding: 7px !important;
  background:
    repeating-linear-gradient(46deg, rgba(60,34,14,.25) 0 2px, transparent 2px 7px),
    linear-gradient(140deg, #a8763f, #6d4526 55%, #4e2f16) !important;
  border: 2px solid #3b210f !important;
  box-shadow:
    inset 0 2px 0 rgba(230,190,130,.5),
    inset 0 -2px 0 rgba(0,0,0,.4),
    4px 7px 16px -6px rgba(52,32,14,.75) !important;
}
[data-cv-skin="storybook"] [data-cv-part="portrait"] > * { border-radius: 2px !important; }
[data-cv-skin="storybook"] [data-cv-part="portrait"] img { filter: none !important; }
/* Brass pins at the frame corners. */
[data-cv-skin="storybook"] [data-cv-part="portrait"]::after {
  content: '';
  position: absolute; inset: 4px;
  pointer-events: none; z-index: 3;
  background:
    radial-gradient(circle, #e8c47a 0 40%, #8a6320 41%, transparent 62%) 0 0/7px 7px no-repeat,
    radial-gradient(circle, #e8c47a 0 40%, #8a6320 41%, transparent 62%) 100% 0/7px 7px no-repeat,
    radial-gradient(circle, #e8c47a 0 40%, #8a6320 41%, transparent 62%) 0 100%/7px 7px no-repeat,
    radial-gradient(circle, #e8c47a 0 40%, #8a6320 41%, transparent 62%) 100% 100%/7px 7px no-repeat;
}

/* ── Name is engraved, not typed ── */
[data-cv-skin="storybook"] [data-cv-part="name"] {
  font-family: 'IM Fell English', 'Playfair Display', Georgia, serif !important;
  font-size: 25px !important;
  letter-spacing: .01em !important;
  color: #4a2c12 !important;
  text-shadow: 0 1px 0 rgba(255,248,225,.85), 0 -1px 0 rgba(74,44,18,.25);
}

/* ── Bio reads as ink written onto ruled parchment ── */
[data-cv-skin="storybook"] [data-cv-part="bio"] {
  font-family: 'IM Fell English', Georgia, serif !important;
  font-style: italic;
  font-size: 14.5px !important;
  color: #4a3521 !important;
  line-height: 1.75 !important;
  padding: 12px 14px 14px 22px !important;
  position: relative;
  background:
    repeating-linear-gradient(0deg, transparent 0 27px, rgba(109,75,41,.16) 27px 28px),
    linear-gradient(rgba(150,110,58,.07), transparent) !important;
  border-left: 3px double rgba(109,75,41,.5);
}
[data-cv-skin="storybook"] [data-cv-part="bio"]::before {
  content: '“';
  position: absolute; left: 5px; top: 1px;
  font-size: 28px; line-height: 1; color: rgba(109,75,41,.45);
}

/* ── Buttons are carved wooden plaques with bevelled ends ── */
[data-cv-skin="storybook"] button {
  background:
    repeating-linear-gradient(93deg, rgba(60,34,14,.16) 0 2px, transparent 2px 8px),
    linear-gradient(#c08d4e, #94622f 52%, #7a4c22) !important;
  color: #fdf1d6 !important;
  border: 1.5px solid #4a2a12 !important;
  border-radius: 4px !important;
  font-family: 'IM Fell English', Georgia, serif !important;
  font-weight: 700 !important;
  letter-spacing: .04em;
  text-shadow: 0 1px 1px rgba(50,26,8,.75);
  clip-path: polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%);
  box-shadow:
    inset 0 2px 0 rgba(240,200,140,.45),
    inset 0 -3px 0 rgba(48,26,8,.5),
    2px 3px 0 rgba(58,34,14,.45) !important;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
[data-cv-skin="storybook"] button:active {
  transform: translate(1px,2px);
  box-shadow: inset 0 2px 0 rgba(240,200,140,.45), inset 0 -3px 0 rgba(48,26,8,.5) !important;
}
[data-cv-skin="storybook"] button svg { color: #fdf1d6; }
/* Primary action gets a wax-seal red plaque instead of oak. */
[data-cv-skin="storybook"] button.btn-primary {
  background:
    repeating-linear-gradient(93deg, rgba(40,10,4,.18) 0 2px, transparent 2px 8px),
    linear-gradient(#a4432a, #7d2c17 52%, #631f0f) !important;
  border-color: #45150a !important;
  box-shadow:
    inset 0 2px 0 rgba(255,170,140,.4),
    inset 0 -3px 0 rgba(40,10,4,.55),
    2px 3px 0 rgba(58,20,10,.5) !important;
}
[data-cv-skin="storybook"] button.btn-primary svg { color: #ffe6d2; }

/* Photos keep their real colours — only their FRAMES are wooden. The
   avatar and banner are the player's own images; ageing them made the
   whole page look like one flat brown wash. */
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

/* ══════════════════════════════════════════════════════════════════
   ICE — a glacier character sheet.
   ══════════════════════════════════════════════════════════════════ */
[data-cv-skin="ice"] [style*="--surface"] {
  position: relative;
  border-radius: 5px !important;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.85),
    inset 0 -2px 0 rgba(120,170,215,.4),
    0 8px 20px -10px rgba(24,60,100,.6) !important;
}
/* Icicles hanging from the underside of every slab. */
[data-cv-skin="ice"] [style*="--surface"]::after {
  content: '';
  position: absolute; left: 6px; right: 6px; top: 100%; height: 9px;
  pointer-events: none; z-index: 2;
  background:
    linear-gradient(to bottom, rgba(226,241,253,.95), rgba(180,215,240,0)) 0 0/7px 9px repeat-x;
  -webkit-mask-image: linear-gradient(135deg, transparent 0 3px, #000 3px) 0 0/14px 9px repeat-x;
          mask-image: linear-gradient(135deg, transparent 0 3px, #000 3px) 0 0/14px 9px repeat-x;
}
/* Frost creeping in from the corners. */
[data-cv-skin="ice"] [style*="--surface"]::before {
  content: '';
  position: absolute; inset: 0;
  pointer-events: none; z-index: 1;
  background:
    radial-gradient(circle at 0 0, rgba(255,255,255,.75), transparent 26%),
    radial-gradient(circle at 100% 0, rgba(255,255,255,.65), transparent 24%),
    radial-gradient(circle at 100% 100%, rgba(255,255,255,.5), transparent 22%),
    radial-gradient(circle at 0 100%, rgba(255,255,255,.5), transparent 22%);
}
/* Banner: full-colour art set into a thick ice frame. */
[data-cv-skin="ice"] [data-cv-part="banner"] {
  height: 138px !important;
  border: 9px solid #cfe6f8 !important;
  border-bottom-width: 12px !important;
  border-image: repeating-linear-gradient(118deg, #ffffff 0 3px, #b9d8ef 3px 9px) 9 / 9px / 0 stretch;
  background: linear-gradient(#dcecfa, #9dc2e2) !important;
  box-shadow:
    inset 0 0 0 2px rgba(255,255,255,.9),
    inset 0 -12px 24px -12px rgba(30,70,110,.5),
    0 6px 16px -8px rgba(24,60,100,.6);
}
[data-cv-skin="ice"] [data-cv-part="banner"] img,
[data-cv-skin="ice"] [data-cv-part="banner"] video { filter: none; opacity: 1; }
/* Portrait: crystal frame with gem studs. */
[data-cv-skin="ice"] [data-cv-part="portrait"] {
  position: relative;
  border-radius: 4px !important;
  padding: 7px !important;
  background: repeating-linear-gradient(120deg, #ffffff 0 3px, #a9cee9 3px 9px) !important;
  border: 2px solid #7fa9cc !important;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.95),
    inset 0 -2px 0 rgba(90,140,185,.55),
    0 8px 18px -8px rgba(24,60,100,.7) !important;
}
[data-cv-skin="ice"] [data-cv-part="portrait"] > * { border-radius: 2px !important; }
[data-cv-skin="ice"] [data-cv-part="portrait"] img { filter: none !important; }
[data-cv-skin="ice"] [data-cv-part="portrait"]::after {
  content: '';
  position: absolute; inset: 3px;
  pointer-events: none; z-index: 3;
  background:
    linear-gradient(45deg, #eaf7ff 0 50%, #6fb2dd 50%) 0 0/8px 8px no-repeat,
    linear-gradient(135deg, #eaf7ff 0 50%, #6fb2dd 50%) 100% 0/8px 8px no-repeat,
    linear-gradient(315deg, #eaf7ff 0 50%, #6fb2dd 50%) 0 100%/8px 8px no-repeat,
    linear-gradient(225deg, #eaf7ff 0 50%, #6fb2dd 50%) 100% 100%/8px 8px no-repeat;
}
[data-cv-skin="ice"] [data-cv-part="name"] {
  font-family: 'Cinzel', Georgia, serif !important;
  font-size: 23px !important;
  letter-spacing: .04em !important;
  color: #123a63 !important;
  text-shadow: 0 1px 0 rgba(255,255,255,.95), 0 2px 6px rgba(120,190,235,.6);
}
[data-cv-skin="ice"] [data-cv-part="bio"] {
  font-family: 'Cinzel', Georgia, serif !important;
  font-size: 13.5px !important;
  color: #1d4470 !important;
  line-height: 1.7 !important;
  padding: 12px 14px !important;
  background: linear-gradient(rgba(255,255,255,.5), rgba(255,255,255,.15)) !important;
  border-left: 3px solid rgba(127,214,247,.9);
}
/* Buttons are carved crystal: chamfered, lit from above. */
[data-cv-skin="ice"] button {
  background: linear-gradient(#f2faff, #bcdcf3 48%, #8fbde0) !important;
  color: #10365c !important;
  border: 1.5px solid #7fadd0 !important;
  border-radius: 3px !important;
  font-family: 'Cinzel', Georgia, serif !important;
  font-weight: 700 !important;
  letter-spacing: .05em;
  text-shadow: 0 1px 0 rgba(255,255,255,.9);
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.95),
    inset 0 -3px 0 rgba(105,155,200,.55),
    0 4px 10px -5px rgba(24,60,100,.7) !important;
}
[data-cv-skin="ice"] button:active { transform: translateY(2px); }
[data-cv-skin="ice"] button svg { color: #1a4c7c; }
[data-cv-skin="ice"] button.btn-primary {
  background: linear-gradient(#7fd6f7, #2b7cc7 55%, #1c5c9c) !important;
  color: #ffffff !important;
  border-color: #14477d !important;
  text-shadow: 0 1px 2px rgba(8,32,60,.6);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.6),
    inset 0 -3px 0 rgba(10,40,72,.5),
    0 0 16px rgba(127,214,247,.55) !important;
}
[data-cv-skin="ice"] button.btn-primary svg { color: #fff; }
[data-cv-skin="ice"] ::selection { background: rgba(43,124,199,.28); color: #12304f; }

/* ══════════════════════════════════════════════════════════════════
   COMIC — inked panels on a halftone press.
   Cards get a small alternating tilt so the layout has movement
   instead of stacking into a neat column of rectangles.
   ══════════════════════════════════════════════════════════════════ */
[data-cv-skin="comic"] [style*="--surface"] {
  position: relative;
  border: 2.5px solid #0c0620 !important;
  border-radius: 3px !important;
  box-shadow: 5px 6px 0 rgba(8,3,24,.75) !important;
  transform: rotate(-0.5deg);
}
[data-cv-skin="comic"] [style*="--surface"]:nth-of-type(even) { transform: rotate(0.55deg); }
[data-cv-skin="comic"] [style*="--surface"]:nth-of-type(3n) { transform: rotate(0.25deg); }
/* Speed lines raking out of the top-left corner of each panel. */
[data-cv-skin="comic"] [style*="--surface"]::before {
  content: '';
  position: absolute; inset: 0;
  pointer-events: none; z-index: 1;
  background: repeating-linear-gradient(58deg, rgba(255,255,255,.09) 0 1px, transparent 1px 9px);
  -webkit-mask-image: radial-gradient(circle at 0 0, #000, transparent 40%);
          mask-image: radial-gradient(circle at 0 0, #000, transparent 40%);
}
[data-cv-skin="comic"] [data-cv-part="banner"] {
  height: 140px !important;
  border: 3px solid #0c0620 !important;
  border-bottom-width: 5px !important;
  background: linear-gradient(#331c6e, #170d33) !important;
  box-shadow: inset 0 -30px 44px -20px rgba(8,3,24,.9);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 16px), 0 100%);
}
[data-cv-skin="comic"] [data-cv-part="banner"] img,
[data-cv-skin="comic"] [data-cv-part="banner"] video {
  filter: saturate(1.35) contrast(1.15);
  opacity: 1;
}
[data-cv-skin="comic"] [data-cv-part="portrait"] {
  position: relative;
  border-radius: 2px !important;
  padding: 5px !important;
  background: linear-gradient(140deg, #ff2e88, #35e0ff) !important;
  border: 3px solid #0c0620 !important;
  transform: rotate(-2.2deg);
  box-shadow: 5px 6px 0 rgba(8,3,24,.8) !important;
}
[data-cv-skin="comic"] [data-cv-part="portrait"] > * { border-radius: 0 !important; }
[data-cv-skin="comic"] [data-cv-part="portrait"] img { filter: saturate(1.2) contrast(1.1) !important; }
[data-cv-skin="comic"] [data-cv-part="name"] {
  font-family: 'Bangers', Impact, sans-serif !important;
  font-size: 32px !important;
  letter-spacing: .05em !important;
  color: #ffffff !important;
  transform: rotate(-1.5deg);
  display: inline-block;
  text-shadow:
    2px 0 0 #0c0620, -2px 0 0 #0c0620, 0 2px 0 #0c0620, 0 -2px 0 #0c0620,
    4px 5px 0 #ff2e88;
}
[data-cv-skin="comic"] [data-cv-part="bio"] {
  font-family: 'Poppins', sans-serif !important;
  font-size: 13px !important;
  color: #e8dfff !important;
  line-height: 1.6 !important;
  padding: 12px 14px !important;
  background: linear-gradient(158deg, rgba(255,46,136,.16), rgba(53,224,255,.1)) !important;
  border: 2.5px solid #0c0620;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 14px) 100%, 0 100%);
}
/* Buttons are sheared comic plates with a hard offset shadow. */
[data-cv-skin="comic"] button {
  background: linear-gradient(#43268a, #2a1663) !important;
  color: #ffffff !important;
  border: 2.5px solid #0c0620 !important;
  border-radius: 2px !important;
  font-family: 'Bangers', Impact, sans-serif !important;
  font-weight: 400 !important;
  letter-spacing: .09em;
  text-shadow: 1.5px 1.5px 0 rgba(8,3,24,.85);
  clip-path: polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%);
  box-shadow: 4px 4px 0 rgba(8,3,24,.85) !important;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
[data-cv-skin="comic"] button:active {
  transform: translate(3px,3px);
  box-shadow: 1px 1px 0 rgba(8,3,24,.85) !important;
}
[data-cv-skin="comic"] button svg { color: #35e0ff; }
[data-cv-skin="comic"] button.btn-primary {
  background: linear-gradient(#ff4d9c, #e0116f) !important;
  color: #fff !important;
  box-shadow: 4px 4px 0 #35e0ff !important;
}
[data-cv-skin="comic"] button.btn-primary:active { box-shadow: 1px 1px 0 #35e0ff !important; }
[data-cv-skin="comic"] button.btn-primary svg { color: #fff; }
[data-cv-skin="comic"] ::selection { background: #ff2e88; color: #fff; }

@media (prefers-reduced-motion: reduce) {
  [data-cv-skin] button { transition: none; }
  [data-cv-skin] button:active { transform: none; }
  [data-cv-skin="comic"] [style*="--surface"],
  [data-cv-skin="comic"] [data-cv-part="portrait"],
  [data-cv-skin="comic"] [data-cv-part="name"] { transform: none; }
}

/* Spinner for the picker's saving state. Lives here because
   <ProfileSkinStyles/> is the one stylesheet guaranteed to be mounted
   whenever the picker is open, and index.css has no plain spin keyframe. */
@keyframes cv-skin-spin { to { transform: rotate(360deg); } }
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
