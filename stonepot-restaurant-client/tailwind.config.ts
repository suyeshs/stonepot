import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors from CSS variables
        primary: {
          DEFAULT: 'var(--color-primary-500)',
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
        },
        secondary: 'var(--color-secondary-500)',
        accent: {
          DEFAULT: 'var(--color-accent-500)',
          hover: 'var(--color-accent-600)',
        },
        // Dietary colors
        veg: {
          light: 'var(--color-veg-100)',
          DEFAULT: 'var(--color-veg-500)',
          dark: 'var(--color-veg-700)',
        },
        'non-veg': {
          light: 'var(--color-non-veg-100)',
          DEFAULT: 'var(--color-non-veg-500)',
          dark: 'var(--color-non-veg-700)',
        },
        // Voice state colors
        voice: {
          idle: 'var(--color-voice-idle)',
          listening: 'var(--color-voice-listening)',
          thinking: 'var(--color-voice-thinking)',
          speaking: 'var(--color-voice-speaking)',
        },
        // Status colors
        success: 'var(--color-success-500)',
        warning: 'var(--color-warning-500)',
        error: 'var(--color-error-500)',
        info: 'var(--color-info-500)',
      },
      boxShadow: {
        'neu-sm': 'var(--shadow-sm)',
        'neu-md': 'var(--shadow-md)',
        'neu-lg': 'var(--shadow-lg)',
        'neu-xl': 'var(--shadow-xl)',
        'neu-inner': 'var(--shadow-inner)',
      },
      borderRadius: {
        'neu-sm': 'var(--radius-sm)',
        'neu-md': 'var(--radius-md)',
        'neu-lg': 'var(--radius-lg)',
        'neu-xl': 'var(--radius-xl)',
        'neu-2xl': 'var(--radius-2xl)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        spring: 'var(--easing-spring)',
      },
    }
  },
  plugins: []
};

export default config;
