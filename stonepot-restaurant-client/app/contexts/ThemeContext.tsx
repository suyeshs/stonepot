/**
 * Theme Context - Provides theme to all components
 */

'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { MultimodalRestaurantTheme } from '../types/theme';
import { injectCSSVariables } from '../lib/css-generator';

interface ThemeContextValue {
  theme: MultimodalRestaurantTheme | null;
  isLoading: boolean;
  error: string | null;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: null,
  isLoading: false,
  error: null,
});

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme: MultimodalRestaurantTheme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setTheme] = useState<MultimodalRestaurantTheme>(initialTheme);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inject CSS variables on theme change
  useEffect(() => {
    if (theme) {
      injectCSSVariables(theme);
    }
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    isLoading,
    error,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
