// tokens.js — Design tokens para consistent styling (mobile)
// Alinhado com Sanctuary Terapêutico redesign (Wave 4-5)

export const colors = {
  // Sanctuary Palette (Redesign Wave 6)
  primary: {
    50: '#f0fdf9',
    100: '#ccfbf1',
    200: '#99f6e4',
    500: '#14b8a6', // Teal/Emerald
    600: '#005db6', // Deep Blue (Brand)
    700: '#0f766e',
    900: '#134e4a',
  },

  // Neutral (grays/surfaces)
  neutral: {
    50: '#f8fafb', // Surface
    100: '#f1f4f9',
    200: '#e1e3e8',
    300: '#c1c7ce',
    400: '#8e9199',
    500: '#71777f',
    600: '#44474e',
    700: '#2e3036',
    800: '#1a1c1e', // On Surface
    900: '#000000',
  },

  // Status semântico
  status: {
    success: '#4fb3a4',
    warning: '#904d00',
    error: '#ba1a1a',
    info: '#005db6',
  },

  // Text semântico (Aliases para retrocompatibilidade e semântica)
  text: {
    primary: '#1a1c1e', // neutral.800
    secondary: '#44474e', // neutral.600
    muted: '#8e9199', // neutral.400
    inverse: '#ffffff',
  },

  // Borders
  border: {
    default: '#e1e3e8', // neutral.200
    light: '#f1f4f9', // neutral.100
  },

  // Backgrounds semântico
  bg: {
    screen: '#f8fafb', // Sanctuary Surface
    card: '#ffffff',
    overlay: 'rgba(26, 28, 29, 0.4)',
  },

  // Tab navigation
  tab: {
    activeTint: '#005db6', // primary.600
    inactiveTint: '#8e9199', // neutral.400
    bgDefault: '#ffffff',
  },
}

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
}

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
}

export const shadows = {
  // Ambient Shadows (Spec H5.7.5)
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24, // Ambient Shadow diffusion
    elevation: 8,
  },
}
