import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Soft Gothic Obsidian & Cathedral Slate (low eye-strain, zero harsh pitch-black/white glare)
        background: '#0E0D10',
        surface: '#16151A',
        elevated: '#1E1C23',
        stoneborder: '#27242E',
        brand: {
          DEFAULT: '#DDD7CC', // Warm Parchment / Bone Ivory
          muted: '#8E877D',   // Soft Ash
          subtle: '#5E5952',  // Weathered Stone
        },
        gothic: {
          DEFAULT: '#B5A082', // Aged Bronze / Antique Pale Gold
          muted: '#8A7960',
          crimson: '#8F5154', // Dried Wine / Muted Gothic Crimson
        },
        // Desaturated, calm semantic accents
        mode: {
          hypertrophy: '#959FA8', // Slate Iron
          strength: '#B5A082',    // Antique Bronze
          calisthenics: '#789483', // Weathered Moss
          hyrox: '#A67B60',       // Forged Terracotta
          cardio: '#7B93A1',      // Mist Steel
        },
        status: {
          advance: '#6F917C',     // Calm Sage
          regress: '#9C5B5E',     // Muted Wine
        },
      },
      fontFamily: {
        gothic: ['var(--font-gothic)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      transitionTimingFunction: {
        kairos: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
