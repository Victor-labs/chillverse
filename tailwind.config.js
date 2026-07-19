// tailwind.config.js
// Semantic-first: every color utility maps to the CSS custom properties
// defined per-theme in src/app/index.css, so Tailwind classes are
// automatically theme-aware. The old hard-coded `neu.*` values and the
// entirely unused `chill.*` palette are gone — index.css is the single
// source of truth for color.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic surfaces (theme-aware)
        bg:        'var(--bg)',
        nav:       'var(--nav)',
        surface:   'var(--surface)',
        surface2:  'var(--surface2)',
        surface3:  'var(--surface3)',
        active:    'var(--active)',
        popover:   'var(--popover)',
        // Text
        body:      'var(--text)',
        secondary: 'var(--text-secondary)',
        muted:     'var(--text-muted)',
        // Accent (theme-aware: orange on free themes, per-theme on premium)
        accent:  'var(--accent)',
        accent2: 'var(--accent2)',
        // Brand + status primitives (constant)
        gold:   'var(--gold)',
        blue:   'var(--blue)',
        purple: 'var(--purple)',
        green:  'var(--green)',
        pink:   'var(--pink)',
        red:    'var(--red)',
        violet: 'var(--brand-violet)',
        cyan:   'var(--brand-cyan)',
        // Legacy `neu.*` names kept as aliases so existing `bg-neu-surface`
        // style classes keep working during the Phase 2 sweep.
        neu: {
          bg:       'var(--bg)',
          surface:  'var(--surface)',
          surface2: 'var(--surface2)',
          surface3: 'var(--surface3)',
          dark:     'var(--neu-dark)',
          light:    'var(--neu-light)',
          accent:   'var(--accent)',
          accent2:  'var(--accent2)',
          gold:     'var(--gold)',
          text:     'var(--text)',
          dim:      'var(--text-secondary)',
          muted:    'var(--text-muted)',
          blue:     'var(--blue)',
          purple:   'var(--purple)',
          green:    'var(--green)',
          pink:     'var(--pink)',
          red:      'var(--red)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        strong:  'var(--border-strong)',
      },
      borderRadius: {
        card: 'var(--radius)',
        el:   'var(--radius-sm)',
        tight:'var(--radius-xs)',
      },
      boxShadow: {
        raise:    'var(--elev-raise)',
        'raise-sm':'var(--elev-raise-sm)',
        hover:    'var(--elev-hover)',
        inset:    'var(--elev-inset)',
        popover:  'var(--elev-popover)',
        ring:     'var(--ring)',
      },
      // Type scale — one place; use as text-display / text-title / etc.
      fontSize: {
        display: ['clamp(28px,4vw,34px)', { lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.02em' }],
        title:   ['22px',   { lineHeight: '1.2',  fontWeight: '700', letterSpacing: '-0.02em' }],
        heading: ['16.5px', { lineHeight: '1.3',  fontWeight: '700', letterSpacing: '-0.01em' }],
        body:    ['13.5px', { lineHeight: '1.55', fontWeight: '400' }],
        caption: ['11.5px', { lineHeight: '1.4',  fontWeight: '500' }],
        label:   ['11px',   { lineHeight: '1.2',  fontWeight: '700', letterSpacing: '0.08em' }],
        micro:   ['10px',   { lineHeight: '1.2',  fontWeight: '600' }],
      },
      // Motion language — durations + easings, everywhere
      transitionDuration: {
        fast:   '120ms',
        base:   '200ms',
        slow:   '320ms',
        reveal: '550ms',
      },
      transitionTimingFunction: {
        out:    'cubic-bezier(0.16, 1, 0.3, 1)',
        inout:  'cubic-bezier(0.65, 0, 0.35, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
}
