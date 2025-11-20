/**
 * Theme types for multimodal restaurant theme
 * Matches the theme-edge-worker schema
 */

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface DietaryColors {
  veg: ColorScale;
  nonVeg: ColorScale;
  vegan?: ColorScale;
  glutenFree?: ColorScale;
}

export interface VoiceStateColors {
  idle: string;
  listening: string;
  thinking: string;
  speaking: string;
}

export interface DesignTokens {
  colors: {
    primary: ColorScale;
    secondary: ColorScale;
    accent: ColorScale;
    background: {
      main: string;
      surface: string;
      elevated: string;
      gradient?: {
        from: string;
        to: string;
        direction: string;
      };
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      inverse: string;
    };
    dietary: DietaryColors;
    voiceStates: VoiceStateColors;
    status: {
      success: ColorScale;
      warning: ColorScale;
      error: ColorScale;
      info: ColorScale;
    };
  };
  typography: {
    fontFamily: {
      sans: string[];
      serif?: string[];
      mono?: string[];
    };
    scale: Record<string, string>;
    weights: Record<string, number>;
    lineHeights: Record<string, string>;
  };
  spacing: {
    unit: string;
    scale: Record<string, string>;
  };
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  breakpoints: Record<string, string>;
  animations: {
    duration: Record<string, string>;
    easing: Record<string, string>;
  };
}

export interface ComponentConfig {
  [key: string]: any;
}

export interface LayoutConfig {
  type: string;
  [key: string]: any;
}

export interface MultimodalRestaurantTheme {
  version: string;
  meta: {
    name: string;
    description: string;
    restaurantId?: string;
    author?: string;
    createdAt: string;
    updatedAt: string;
    version: string;
    tags: string[];
  };
  designTokens: DesignTokens;
  layouts: {
    landing?: LayoutConfig;
    voiceAssisted?: LayoutConfig;
    standardBrowse?: LayoutConfig;
  };
  components?: {
    voiceOrb?: ComponentConfig;
    menuCard?: ComponentConfig;
    cartIsland?: ComponentConfig;
    categoryCarousel?: ComponentConfig;
    dishModal?: ComponentConfig;
    orderProgress?: ComponentConfig;
    [key: string]: ComponentConfig | undefined;
  };
  interactions?: {
    voice?: any;
    gestures?: any;
    haptics?: any;
    keyboard?: any;
  };
  accessibility?: {
    level: string;
    features: string[];
  };
  customCSS?: string;
}

export interface ThemeResponse {
  theme: MultimodalRestaurantTheme;
  preset?: string;
  timestamp: string;
}
