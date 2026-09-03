/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Redesign palette (design_handoff_map_first_planner/README.md
      // "Design tokens") — dark theme only, oklch kept verbatim rather than
      // converted to hex so it stays perceptually even.
      colors: {
        bg: 'oklch(0.17 0.012 250)',
        'surface-1': 'oklch(0.195 0.012 250)',
        'surface-2': 'oklch(0.20 0.013 250)',
        'surface-3': 'oklch(0.205 0.012 250)',
        'surface-4': 'oklch(0.215 0.012 250)',
        field: 'oklch(0.22 0.012 250)',
        control: 'oklch(0.24 0.013 250)',
        'control-hover': 'oklch(0.28 0.014 250)',
        border: 'oklch(0.27 0.012 250)',
        'border-strong': 'oklch(0.31 0.012 250)',
        text: 'oklch(0.95 0.005 250)',
        'text-2': 'oklch(0.80 0.008 250)',
        'text-3': 'oklch(0.68 0.01 250)',
        'text-4': 'oklch(0.62 0.01 250)',
        'text-5': 'oklch(0.58 0.01 250)',
        accent: 'oklch(0.72 0.13 215)',
        'on-accent': 'oklch(0.16 0.02 240)',
        'accent-surface': 'oklch(0.25 0.02 235)',
        wishlist: 'oklch(0.78 0.13 80)',
        'warn-bg': 'oklch(0.26 0.045 80)',
        'warn-border': 'oklch(0.42 0.09 80)',
        'warn-text': 'oklch(0.88 0.07 85)',
        daylight: 'oklch(0.78 0.12 90)',
        'danger-border': 'oklch(0.45 0.10 25)',
        'danger-text': 'oklch(0.78 0.11 25)',
        scrim: 'oklch(0.12 0.015 250 / 0.72)',
        // Small circular controls floating over a photo.
        glass: 'oklch(0.18 0.012 250 / 0.72)',
      },
      boxShadow: {
        card: '0 18px 50px oklch(0.10 0.02 250 / 0.55)',
        'phone-card': '0 10px 30px oklch(0.10 0.02 250 / 0.55)',
        expanded: '0 30px 80px oklch(0.08 0.02 250 / 0.6)',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      // The handoff's one breakpoint (distinct from Tailwind's default
      // md=768/lg=1024) — below it, the phone layout.
      screens: {
        desktop: '860px',
      },
      // The phone card's swipe-discoverability cue (WORK 12.7): rest, a
      // -6px kick with a lift, then a -2px settle, on a 2.4s loop.
      keyframes: {
        'om-nudge': {
          '0%, 20%, 100%': { transform: 'translateX(0)', opacity: '0.75' },
          '35%': { transform: 'translateX(-6px)', opacity: '1' },
          '55%': { transform: 'translateX(-2px)', opacity: '0.9' },
        },
        // Sign-in photo rotation: the outgoing photo fades out over the
        // incoming one (which is already at full opacity beneath it).
        'login-photo-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
      },
      animation: {
        'om-nudge': 'om-nudge 2.4s ease-in-out infinite',
        'login-photo-out': 'login-photo-out 900ms ease-in-out forwards',
      },
    },
  },
  plugins: [],
};
