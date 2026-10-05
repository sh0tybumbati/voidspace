/** @type {import('tailwindcss').Config} */
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['class', '.dark'],
  theme: {
    extend: {
      colors: {
        bg: rgb('bg'),
        surface: { DEFAULT: rgb('surface'), 2: rgb('surface-2'), 3: rgb('surface-3') },
        line: { DEFAULT: rgb('line'), strong: rgb('line-strong') },
        ink: { DEFAULT: rgb('text'), 2: rgb('text-2') },
        muted: rgb('muted'),
        accent: { DEFAULT: rgb('accent'), ink: rgb('accent-ink'), text: rgb('accent-text') },
        danger: rgb('danger'),
        warn: rgb('warn'),
        ok: rgb('ok'),
        info: rgb('info'),
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { DEFAULT: '6px', md: '8px', lg: '10px' },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.35)' }, '100%': { transform: 'scale(1)' } },
        slide: { from: { opacity: 0, transform: 'translateX(14px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgb(var(--accent) / .5)' }, '100%': { boxShadow: '0 0 0 8px rgb(var(--accent) / 0)' } },
      },
      animation: {
        rise: 'rise .35s cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop .3s ease-out',
        slide: 'slide .25s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
        ring: 'pulseRing 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
