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
        // Luminous Obsidian & Imperial Gold (vibrant depth, high contrast, zero flatness)
        background: '#0B0A0E',
        surface: '#14131A',
        elevated: '#1D1B26',
        stoneborder: '#2A2736',
        brand: {
          DEFAULT: '#F4F0E8', // Crisp Warm Alabaster
          muted: '#A39E93',   // Clear Secondary Slate-Ivory
          subtle: '#6E6A63',  // Balanced Muted Stone
        },
        gothic: {
          DEFAULT: '#DEB868', // Radiant Imperial Gold
          muted: '#A88948',
          crimson: '#E11D48', // Vivid Crimson
        },
        // Vibrant, unmistakable discipline accents
        mode: {
          hypertrophy: '#60A5FA', // Electric Sapphire
          strength: '#F59E0B',    // Molten Amber Gold
          calisthenics: '#10B981', // Kinetic Emerald
          hyrox: '#F97316',       // Competition Flame
          cardio: '#38BDF8',      // Aero Cyan
        },
        status: {
          advance: '#10B981',     // Vibrant Emerald
          regress: '#F43F5E',     // Vivid Ruby
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
