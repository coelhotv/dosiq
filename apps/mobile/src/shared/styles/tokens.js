// tokens.js — Design tokens para consistent styling (mobile)
// Alinhado com Sanctuary Terapêutico redesign (Wave 4-5)

export const colors = {
  // Primária
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1e40af',

  // Neutral (grays)
  white: '#ffffff',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  black: '#0f172a',

  // Status
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  errorLight: '#fca5a5',
  info: '#0ea5e9',

  // Text
  text: {
    primary: '#1e293b',
    secondary: '#64748b',
    tertiary: '#94a3b8',
    inverse: '#ffffff',
  },

  // Backgrounds
  bg: {
    default: '#f8fafc',
    surface: '#ffffff',
    overlay: 'rgba(15, 23, 42, 0.5)',
  },

  // Borders
  border: {
    default: '#e2e8f0',
    light: '#f1f5f9',
    dark: '#cbd5e1',
  },

  // Tab navigation
  tab: {
    activeTint: '#2563eb',
    inactiveTint: '#94a3b8',
    bgDefault: '#ffffff',
  },
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

export const borderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
}

export const shadows = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
}
