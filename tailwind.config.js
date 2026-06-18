// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        chill: {
          bg: '#04040f',
          bg2: '#080820',
          surface: '#0f0f28',
          surface2: '#16163a',
          border: 'rgba(108,80,255,0.16)',
          borderBright: 'rgba(108,80,255,0.42)',
          violet: '#6c50ff',
          violetSoft: '#a78bfa',
          cyan: '#00e5ff',
          pink: '#ff4ecd',
          amber: '#ffb800',
          green: '#00ff87',
          red: '#ff4f4f',
          orange: '#ff6b00',
          orange2: '#ff9a3c',
          blue: '#4f8ef7',
          text: '#eeeaff',
          textSecondary: '#9b96c0',
          textMuted: '#5a5678',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
