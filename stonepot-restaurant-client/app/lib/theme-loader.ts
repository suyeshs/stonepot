/**
 * Theme Loader - Fetches theme from theme-edge-worker
 * Uses Next.js caching for performance
 */

import { MultimodalRestaurantTheme, ThemeResponse } from '../types/theme';

const THEME_WORKER_URL = process.env.NEXT_PUBLIC_THEME_WORKER_URL || 'https://theme-edge-worker.suyesh.workers.dev';
const DEFAULT_PRESET = process.env.NEXT_PUBLIC_THEME_PRESET || 'coorg-food-company';
const CACHE_DURATION = 3600; // 1 hour in seconds

/**
 * Fetch theme from theme-edge-worker
 * Cached using Next.js fetch with revalidation
 */
export async function fetchTheme(preset: string = DEFAULT_PRESET): Promise<MultimodalRestaurantTheme> {
  const url = `${THEME_WORKER_URL}/api/multimodal-restaurant/themes/${preset}`;

  try {
    const response = await fetch(url, {
      next: {
        revalidate: CACHE_DURATION, // ISR: revalidate every 1 hour
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch theme: ${response.status} ${response.statusText}`);
      return getDefaultTheme();
    }

    const data: ThemeResponse = await response.json();
    return data.theme;
  } catch (error) {
    console.error('Error fetching theme:', error);
    return getDefaultTheme();
  }
}

/**
 * Fetch theme client-side (for dynamic updates)
 */
export async function fetchThemeClient(preset: string = DEFAULT_PRESET): Promise<MultimodalRestaurantTheme> {
  const url = `${THEME_WORKER_URL}/api/multimodal-restaurant/themes/${preset}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store', // Client-side: always fresh
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch theme: ${response.status}`);
    }

    const data: ThemeResponse = await response.json();
    return data.theme;
  } catch (error) {
    console.error('Error fetching theme:', error);
    return getDefaultTheme();
  }
}

/**
 * Default fallback theme (matches the neumorphic design already in globals.css)
 */
function getDefaultTheme(): MultimodalRestaurantTheme {
  return {
    version: '1.0.0',
    meta: {
      name: 'Default Restaurant Theme',
      description: 'Fallback theme with neumorphic design',
      author: 'Stonepot Platform',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['default', 'fallback'],
    },
    designTokens: {
      colors: {
        primary: generateColorScale('#ff9500'),
        secondary: generateColorScale('#2c3e50'),
        accent: generateColorScale('#ff9500'),
        background: {
          main: '#e0e5ec',
          surface: '#e0e5ec',
          elevated: '#ffffff',
        },
        text: {
          primary: '#2c3e50',
          secondary: '#7f8c8d',
          tertiary: '#95a5a6',
          inverse: '#ffffff',
        },
        dietary: {
          veg: generateColorScale('#27ae60'),
          nonVeg: generateColorScale('#e74c3c'),
        },
        voiceStates: {
          idle: '#94a3b8',
          listening: '#0ea5e9',
          thinking: '#f59e0b',
          speaking: '#22c55e',
        },
        status: {
          success: generateColorScale('#27ae60'),
          warning: generateColorScale('#f39c12'),
          error: generateColorScale('#e74c3c'),
          info: generateColorScale('#3498db'),
        },
      },
      typography: {
        fontFamily: {
          sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        },
        scale: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem',
        },
        weights: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
        lineHeights: {
          tight: '1.25',
          normal: '1.5',
          relaxed: '1.75',
        },
      },
      spacing: {
        unit: 'px',
        scale: {
          0: '0',
          1: '4px',
          2: '8px',
          3: '12px',
          4: '16px',
          6: '24px',
          8: '32px',
          12: '48px',
          16: '64px',
        },
      },
      borderRadius: {
        none: '0',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        full: '9999px',
      },
      shadows: {
        sm: '-4px -4px 8px rgba(255, 255, 255, 0.6), 4px 4px 8px rgba(0, 0, 0, 0.1)',
        md: '-6px -6px 12px rgba(255, 255, 255, 0.8), 6px 6px 12px rgba(0, 0, 0, 0.15)',
        lg: '-8px -8px 16px rgba(255, 255, 255, 0.9), 8px 8px 16px rgba(0, 0, 0, 0.2)',
        xl: '-12px -12px 24px rgba(255, 255, 255, 1), 12px 12px 24px rgba(0, 0, 0, 0.25)',
        inner: 'inset -4px -4px 8px rgba(255, 255, 255, 0.5), inset 4px 4px 8px rgba(0, 0, 0, 0.1)',
      },
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
      animations: {
        duration: {
          fast: '150ms',
          normal: '300ms',
          slow: '500ms',
        },
        easing: {
          ease: 'ease',
          easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
          easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
          easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
          spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        },
      },
    },
    layouts: {},
    components: {},
  };
}

/**
 * Generate a color scale from a base color
 * Simplified version for fallback
 */
function generateColorScale(baseColor: string): any {
  // Simple fallback - in real theme, this comes from worker
  return {
    50: lighten(baseColor, 0.9),
    100: lighten(baseColor, 0.8),
    200: lighten(baseColor, 0.6),
    300: lighten(baseColor, 0.4),
    400: lighten(baseColor, 0.2),
    500: baseColor,
    600: darken(baseColor, 0.2),
    700: darken(baseColor, 0.4),
    800: darken(baseColor, 0.6),
    900: darken(baseColor, 0.8),
    950: darken(baseColor, 0.9),
  };
}

function lighten(color: string, amount: number): string {
  // Simplified - just return the base color for fallback
  return color;
}

function darken(color: string, amount: number): string {
  // Simplified - just return the base color for fallback
  return color;
}
