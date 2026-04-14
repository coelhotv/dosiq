// tokens.js — Design tokens para consistent styling (mobile)
// Alinhado com Sanctuary Terapêutico redesign (Wave 4-5)

export const colors = {
  // Escala primária (Tailwind-like)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },

  // Neutral (grays)
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Status semântico
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    errorLight: '#fca5a5',
    info: '#0ea5e9',
  },

  // Text semântico
  text: {
    primary: '#1e293b',
    secondary: '#64748b',
    muted: '#94a3b8',
    inverse: '#ffffff',
  },

  // Backgrounds semântico
  bg: {
    screen: '#f8fafc',
    card: '#ffffff',
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

// Escala numérica de espaçamento (Tailwind-like: 1 = 4px)
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
}

export const borderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
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
