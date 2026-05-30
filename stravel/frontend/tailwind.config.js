/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        tablet: '768px',
        'desktop-sm': '1024px',
        desktop: '1280px',
      },
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        border: 'var(--color-border)',
        'text-base': 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'status-pending': 'var(--status-pending)',
        'status-confirmed': 'var(--status-confirmed)',
        'status-modified': 'var(--status-modified)',
        'status-flagged': 'var(--status-flagged)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.touch-pan-y': { 'touch-action': 'pan-y' },
        '.h-dvh': { height: '100dvh' },
        '.min-h-dvh': { 'min-height': '100dvh' },
        '.pb-safe': { 'padding-bottom': 'env(safe-area-inset-bottom, 0px)' },
        '.pt-safe': { 'padding-top': 'env(safe-area-inset-top, 0px)' },
        '.overscroll-contain': { 'overscroll-behavior': 'contain' },
        '.transition-card-settle': {
          transition: [
            'box-shadow 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            'border-color 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            'opacity 360ms ease-out 60ms',
            'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          ].join(', '),
        },
      });
    }),
  ],
};
