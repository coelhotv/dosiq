/**
 * Color Tokens — Sanctuary Design System
 *
 * Pure JavaScript object containing all color values for the design system.
 * Extracted from src/shared/styles/tokens/colors.css
 *
 * These tokens are platform-agnostic and can be consumed by:
 * - Web (CSS custom properties)
 * - Mobile (React Native StyleSheet)
 *
 * @module @meus-remedios/design-tokens/colors
 */

// ============================================
// BRAND COLORS - Primary (Pink/Rosa)
// ============================================
const brandColors = {
  primary: '#ec4899',
  primaryLight: '#f472b6',
  primaryDark: '#db2777',
  primaryBg: '#fdf2f8',
  primaryHover: '#be185d',
}

// ============================================
// BRAND COLORS - Secondary (Cyan)
// ============================================
const secondaryColors = {
  secondary: '#06b6d4',
  secondaryLight: '#22d3ee',
  secondaryDark: '#0891b2',
  secondaryBg: '#ecfeff',
}

// ============================================
// SEMANTIC COLORS - Status
// ============================================
const statusColors = {
  success: '#10b981',
  successLight: '#34d399',
  successBg: '#ecfdf5',

  warning: '#f59e0b',
  warningLight: '#fbbf24',
  warningBg: '#fffbeb',

  error: '#ef4444',
  errorLight: '#f87171',
  errorBg: '#fef2f2',

  info: '#3b82f6',
  infoLight: '#60a5fa',
  infoBg: '#eff6ff',
}

// ============================================
// BACKGROUND COLORS
// ============================================
const backgroundColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f9fafb',
  bgTertiary: '#f3f4f6',
  bgCard: '#ffffff',
  bgOverlay: 'rgba(0, 0, 0, 0.5)',
  bgGlass: 'rgba(255, 255, 255, 0.8)',
  bgGlassDark: 'rgba(17, 24, 39, 0.8)',
}

// ============================================
// TEXT COLORS
// ============================================
const textColors = {
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textTertiary: '#6b7280',
  textInverse: '#ffffff',
  textLink: '#ec4899',
}

// ============================================
// BORDER COLORS
// ============================================
const borderColors = {
  borderLight: '#f3f4f6',
  borderDefault: '#e5e7eb',
  borderDark: '#d1d5db',
}

// ============================================
// TOGGLE & THEME COLORS
// ============================================
const themeColors = {
  toggleTrack: '#e5e7eb',
  toggleTrackDark: '#374151',
  sun: '#f59e0b',
  moon: '#93c5fd',
}

// ============================================
// HEALTH SCORE COLORS
// ============================================
const healthScoreColors = {
  critical: '#ef4444',
  low: '#f97316',
  medium: '#eab308',
  good: '#22c55e',
  excellent: '#06b6d4',
}

// ============================================
// GLOW EFFECTS (WEB-ONLY: box-shadow CSS syntax)
// ============================================
// NOTE: These tokens use CSS box-shadow syntax for shadow effects.
// They are Web-only and cannot be consumed directly by React Native.
// Mobile platforms should use native shadow APIs (shadowColor, shadowOffset, shadowOpacity).
// Reference: ADR-013 — Shadow System (ambient shadows over neon glows).
const glowEffects = {
  cyan: '0 0 10px rgba(6, 182, 212, 0.5)',
  pink: '0 0 10px rgba(236, 72, 153, 0.5)',
  magenta: '0 0 10px rgba(217, 70, 239, 0.5)',
  green: '0 0 10px rgba(16, 185, 129, 0.5)',
  success: '0 0 10px rgba(16, 185, 129, 0.5)',
  warning: '0 0 10px rgba(245, 158, 11, 0.5)',
  error: '0 0 10px rgba(239, 68, 68, 0.5)',
  info: '0 0 10px rgba(59, 130, 246, 0.5)',
}

// ============================================
// CONTEXTUAL GLOW EFFECTS (WEB-ONLY: box-shadow CSS syntax)
// ============================================
// NOTE: Derived from brand and status colors with contextual opacity/blur.
// Web-only tokens using CSS box-shadow syntax.
// Mobile platforms: map to native shadow APIs or alternative visual treatments.
// Values are derived from:
// - brand.primary (#ec4899) for primary effects
// - brand.secondary (#06b6d4) for secondary effects
// - status.success (#10b981), status.warning (#f59e0b), status.error (#ef4444) for state effects
const contextualGlowEffects = {
  hoverPrimary: '0 0 20px rgba(236, 72, 153, 0.3)',
  hoverSecondary: '0 0 20px rgba(6, 182, 212, 0.3)',
  hoverSuccess: '0 0 20px rgba(16, 185, 129, 0.3)',
  hoverWarning: '0 0 20px rgba(245, 158, 11, 0.3)',
  hoverCritical: '0 0 25px rgba(239, 68, 68, 0.4)',

  focusPrimary: '0 0 15px rgba(236, 72, 153, 0.4)',
  focusSecondary: '0 0 15px rgba(6, 182, 212, 0.4)',
  focusSuccess: '0 0 15px rgba(16, 185, 129, 0.4)',

  activePrimary: '0 0 10px rgba(236, 72, 153, 0.3)',
  activeSecondary: '0 0 10px rgba(6, 182, 212, 0.3)',
  activeSuccess: '0 0 10px rgba(16, 185, 129, 0.3)',
}

// ============================================
// STATE COLORS
// ============================================
// NOTE: State colors are derived from brand and neutral base colors.
// primary states (hover, active, focus, loading) use brand.primary (#ec4899) at varying opacity.
// disabled uses black at 10% opacity for accessibility.
// These values should be updated if brand.primary changes.
// Mobile platforms can map these directly (string values are color names + opacity).
const stateColors = {
  hover: 'rgba(236, 72, 153, 0.1)',      // brand.primary at 10% opacity
  active: 'rgba(236, 72, 153, 0.2)',     // brand.primary at 20% opacity
  focus: 'rgba(236, 72, 153, 0.3)',      // brand.primary at 30% opacity
  disabled: 'rgba(0, 0, 0, 0.1)',        // black at 10% opacity
  loading: 'rgba(236, 72, 153, 0.5)',    // brand.primary at 50% opacity
}

// ============================================
// OPACITY VALUES
// ============================================
const opacityValues = {
  disabled: 0.5,
  hover: 0.8,
  focus: 1,
  overlay: 0.9,
  backdrop: 0.75,
}

// ============================================
// GLASSMORPHISM LEVELS (PARTIAL WEB-ONLY: blur property uses CSS syntax)
// ============================================
// NOTE: The 'blur' property uses CSS `blur(Npx)` syntax and is Web-only.
// The 'bg' and 'border' opacity values are portable to mobile (RGBA strings).
// Mobile platforms should:
// 1. Use bg and border opacity values directly for glassmorphic background colors
// 2. Implement blur/frosted glass effects using platform-native APIs
//    (e.g., react-native-blur or custom shaders)
// 3. Or omit blur effects on mobile if not critical to UX
const glassmorphism = {
  light: {
    bg: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(255, 255, 255, 0.05)',
    blur: 'blur(8px)',  // Web-only: CSS backdrop-filter compatible
  },
  default: {
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    blur: 'blur(12px)',  // Web-only: CSS backdrop-filter compatible
  },
  heavy: {
    bg: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.15)',
    blur: 'blur(16px)',  // Web-only: CSS backdrop-filter compatible
  },
  hero: {
    bg: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.2)',
    blur: 'blur(20px)',  // Web-only: CSS backdrop-filter compatible
  },
}

// ============================================
// GRADIENT BACKGROUNDS (WEB-ONLY: linear-gradient CSS syntax)
// ============================================
// NOTE: These tokens use CSS linear-gradient syntax for background layers.
// They are Web-only and cannot be consumed directly by React Native.
// Mobile platforms should either:
// 1. Use gradient libraries like react-native-linear-gradient
// 2. Extract the color array and coordinates separately
// 3. Implement alternative visual treatments
// Each gradient specifies: direction (135deg), start color + opacity, end color + opacity.
const gradients = {
  insight:
    'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(176, 0, 255, 0.1) 100%)',
  hero: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
  alertCritical:
    'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
  success:
    'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
}

// ============================================
// DARK THEME OVERRIDES
// ============================================
const darkModeOverrides = {
  bgPrimary: '#111827',
  bgSecondary: '#1f2937',
  bgTertiary: '#374151',
  bgCard: '#1f2937',
  bgOverlay: 'rgba(0, 0, 0, 0.7)',
  bgGlass: 'rgba(31, 41, 55, 0.8)',
  bgGlassDark: 'rgba(17, 24, 39, 0.9)',

  textPrimary: '#f9fafb',
  textSecondary: '#d1d5db',
  textTertiary: '#9ca3af',
  textMuted: '#6b7280',
  textLink: '#f472b6',

  borderLight: '#1f2937',
  borderDefault: '#374151',
  borderDark: '#4b5563',

  glowCyan: '0 0 15px rgba(34, 211, 238, 0.6)',
  glowPink: '0 0 15px rgba(244, 114, 182, 0.6)',
  glowMagenta: '0 0 15px rgba(232, 121, 249, 0.6)',
  glowGreen: '0 0 15px rgba(52, 211, 153, 0.6)',
  glowSuccess: '0 0 15px rgba(52, 211, 153, 0.6)',
  glowWarning: '0 0 15px rgba(251, 191, 36, 0.6)',
  glowError: '0 0 15px rgba(248, 113, 113, 0.6)',
  glowInfo: '0 0 15px rgba(96, 165, 250, 0.6)',
}

// ============================================
// MAIN EXPORTS
// ============================================
export const colors = {
  brand: brandColors,
  secondary: secondaryColors,
  status: statusColors,
  background: backgroundColors,
  text: textColors,
  border: borderColors,
  theme: themeColors,
  healthScore: healthScoreColors,
  glow: glowEffects,
  contextualGlow: contextualGlowEffects,
  state: stateColors,
  opacity: opacityValues,
  glassmorphism,
  gradients,
  darkMode: darkModeOverrides,
}

export default colors
