/**
 * CSS Generator - Converts theme JSON to CSS variables
 */

import { MultimodalRestaurantTheme } from '../types/theme';

/**
 * Generate CSS variables from theme
 * Injects as inline <style> tag in document head
 */
export function generateCSSVariables(theme: MultimodalRestaurantTheme): string {
  const tokens = theme.designTokens;

  return `
:root {
  /* Primary Colors */
  --color-primary-50: ${tokens.colors.primary[50]};
  --color-primary-100: ${tokens.colors.primary[100]};
  --color-primary-200: ${tokens.colors.primary[200]};
  --color-primary-300: ${tokens.colors.primary[300]};
  --color-primary-400: ${tokens.colors.primary[400]};
  --color-primary-500: ${tokens.colors.primary[500]};
  --color-primary-600: ${tokens.colors.primary[600]};
  --color-primary-700: ${tokens.colors.primary[700]};
  --color-primary-800: ${tokens.colors.primary[800]};
  --color-primary-900: ${tokens.colors.primary[900]};

  /* Secondary Colors */
  --color-secondary-500: ${tokens.colors.secondary[500]};

  /* Accent Colors */
  --color-accent-500: ${tokens.colors.accent[500]};
  --color-accent-600: ${tokens.colors.accent[600]};

  /* Background Colors */
  --color-bg-main: ${tokens.colors.background.main};
  --color-bg-surface: ${tokens.colors.background.surface};
  --color-bg-elevated: ${tokens.colors.background.elevated};

  /* Text Colors */
  --color-text-primary: ${tokens.colors.text.primary};
  --color-text-secondary: ${tokens.colors.text.secondary};
  --color-text-tertiary: ${tokens.colors.text.tertiary};
  --color-text-inverse: ${tokens.colors.text.inverse};

  /* Dietary Colors */
  --color-veg-50: ${tokens.colors.dietary.veg[50]};
  --color-veg-100: ${tokens.colors.dietary.veg[100]};
  --color-veg-500: ${tokens.colors.dietary.veg[500]};
  --color-veg-600: ${tokens.colors.dietary.veg[600]};
  --color-veg-700: ${tokens.colors.dietary.veg[700]};

  --color-non-veg-50: ${tokens.colors.dietary.nonVeg[50]};
  --color-non-veg-100: ${tokens.colors.dietary.nonVeg[100]};
  --color-non-veg-500: ${tokens.colors.dietary.nonVeg[500]};
  --color-non-veg-600: ${tokens.colors.dietary.nonVeg[600]};
  --color-non-veg-700: ${tokens.colors.dietary.nonVeg[700]};

  /* Voice State Colors */
  --color-voice-idle: ${tokens.colors.voiceStates.idle};
  --color-voice-listening: ${tokens.colors.voiceStates.listening};
  --color-voice-thinking: ${tokens.colors.voiceStates.thinking};
  --color-voice-speaking: ${tokens.colors.voiceStates.speaking};

  /* Status Colors */
  --color-success-500: ${tokens.colors.status.success[500]};
  --color-warning-500: ${tokens.colors.status.warning[500]};
  --color-error-500: ${tokens.colors.status.error[500]};
  --color-info-500: ${tokens.colors.status.info[500]};

  /* Typography */
  --font-family-sans: ${tokens.typography.fontFamily.sans.join(', ')};
  --font-size-xs: ${tokens.typography.scale.xs};
  --font-size-sm: ${tokens.typography.scale.sm};
  --font-size-base: ${tokens.typography.scale.base};
  --font-size-lg: ${tokens.typography.scale.lg};
  --font-size-xl: ${tokens.typography.scale.xl};
  --font-size-2xl: ${tokens.typography.scale['2xl']};
  --font-size-3xl: ${tokens.typography.scale['3xl']};
  --font-size-4xl: ${tokens.typography.scale['4xl']};

  --font-weight-normal: ${tokens.typography.weights.normal};
  --font-weight-medium: ${tokens.typography.weights.medium};
  --font-weight-semibold: ${tokens.typography.weights.semibold};
  --font-weight-bold: ${tokens.typography.weights.bold};

  /* Spacing */
  --spacing-0: ${tokens.spacing.scale[0]};
  --spacing-1: ${tokens.spacing.scale[1]};
  --spacing-2: ${tokens.spacing.scale[2]};
  --spacing-3: ${tokens.spacing.scale[3]};
  --spacing-4: ${tokens.spacing.scale[4]};
  --spacing-6: ${tokens.spacing.scale[6]};
  --spacing-8: ${tokens.spacing.scale[8]};
  --spacing-12: ${tokens.spacing.scale[12]};
  --spacing-16: ${tokens.spacing.scale[16]};

  /* Border Radius */
  --radius-none: ${tokens.borderRadius.none};
  --radius-sm: ${tokens.borderRadius.sm};
  --radius-md: ${tokens.borderRadius.md};
  --radius-lg: ${tokens.borderRadius.lg};
  --radius-xl: ${tokens.borderRadius.xl};
  --radius-2xl: ${tokens.borderRadius['2xl']};
  --radius-full: ${tokens.borderRadius.full};

  /* Shadows (Neumorphic) */
  --shadow-sm: ${tokens.shadows.sm};
  --shadow-md: ${tokens.shadows.md};
  --shadow-lg: ${tokens.shadows.lg};
  --shadow-xl: ${tokens.shadows.xl};
  --shadow-inner: ${tokens.shadows.inner};

  /* Animation Durations */
  --duration-fast: ${tokens.animations.duration.fast};
  --duration-normal: ${tokens.animations.duration.normal};
  --duration-slow: ${tokens.animations.duration.slow};

  /* Animation Easing */
  --easing-ease: ${tokens.animations.easing.ease};
  --easing-ease-in: ${tokens.animations.easing.easeIn};
  --easing-ease-out: ${tokens.animations.easing.easeOut};
  --easing-ease-in-out: ${tokens.animations.easing.easeInOut};
  --easing-spring: ${tokens.animations.easing.spring};

  /* Legacy variables (for backwards compatibility with existing globals.css) */
  --neu-bg: var(--color-bg-main);
  --neu-surface: var(--color-bg-surface);
  --neu-text: var(--color-text-primary);
  --neu-text-secondary: var(--color-text-secondary);
  --neu-accent: var(--color-accent-500);
  --neu-accent-hover: var(--color-accent-600);
  --neu-success: var(--color-success-500);
  --neu-error: var(--color-error-500);

  --neu-shadow-light: ${tokens.shadows.sm};
  --neu-shadow-dark: ${tokens.shadows.md};
}
  `.trim();
}

/**
 * Inject CSS variables into document (client-side)
 */
export function injectCSSVariables(theme: MultimodalRestaurantTheme): void {
  if (typeof document === 'undefined') return;

  const css = generateCSSVariables(theme);

  // Remove existing theme style tag
  const existingStyle = document.getElementById('theme-variables');
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create new style tag
  const styleTag = document.createElement('style');
  styleTag.id = 'theme-variables';
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
}
