/**
 * Border Radii Tokens — Sanctuary Design System
 *
 * Pure JavaScript object containing all border-radius values and related border tokens.
 * Extracted from src/shared/styles/tokens/borders.css
 *
 * These tokens are platform-agnostic and can be consumed by:
 * - Web (CSS custom properties)
 * - Mobile (React Native borderRadius)
 *
 * @module @meus-remedios/design-tokens/radii
 */

// ============================================
// BORDER WIDTHS
// ============================================
const borderWidths = {
  none: '0',
  thin: '1px',
  default: '1px',
  medium: '2px',
  thick: '4px',
  heavy: '6px',
  subtle: '1px',
  prominent: '2px',
  hero: '2.5px',
}

// ============================================
// BORDER STYLES
// ============================================
const borderStyles = {
  none: 'none',
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
}

// ============================================
// BORDER RADIUS - Base Scale
// ============================================
const radiusScale = {
  none: '0',
  0: '0',
  sm: '0.125rem',
  1: '0.25rem',
  '1.5': '0.375rem',
  md: '0.375rem',
  2: '0.5rem',
  lg: '0.5rem',
  '2.5': '0.625rem',
  3: '0.75rem',
  xl: '0.75rem',
  '3.5': '0.875rem',
  4: '1rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
  pill: '9999px',
  circle: '50%',
}

// ============================================
// COMPONENT-SPECIFIC BORDER RADIUS
// ============================================
const componentRadii = {
  hero: '1.5rem',
  cardXl: '1.25rem',
  cardLg: '1rem',
  cardMd: '0.75rem',
  cardSm: '0.5rem',
  pill: '9999px',
  input: '0.5rem',
  button: '0.5rem',
  circle: '50%',
  avatar: '50%',
}

// ============================================
// BORDER COLORS
// ============================================
const borderColors = {
  colorLight: '#f3f4f6',
  colorDefault: '#e5e7eb',
  colorDark: '#d1d5db',
  colorPrimary: '#ec4899',
  colorSecondary: '#06b6d4',
  colorSuccess: '#10b981',
  colorWarning: '#f59e0b',
  colorError: '#ef4444',
  colorFocus: 'rgba(236, 72, 153, 0.5)',
}

// ============================================
// FOCUS RINGS
// ============================================
const focusRings = {
  color: '#ec4899',
  width: '2px',
  offset: '2px',
  opacity: 1,
  blur: '0',
  spread: '0',

  blurredColor: 'rgba(236, 72, 153, 0.4)',
  blurredWidth: '4px',
  blurredBlur: '4px',

  insetColor: 'rgba(0, 0, 0, 0.1)',
  insetWidth: '2px',
  insetBlur: '0',
}

// ============================================
// DIVIDER / SEPARATOR
// ============================================
const dividers = {
  color: '#f3f4f6',
  width: '1px',
  style: 'solid',
  marginY: '1rem',
  marginX: '0',
}

// ============================================
// STROKE WIDTHS (for SVGs and icons)
// ============================================
const strokeWidths = {
  thin: '1px',
  default: '1.5px',
  medium: '2px',
  thick: '3px',
}

// ============================================
// MAIN EXPORTS
// ============================================
export const radii = {
  borderWidth: borderWidths,
  borderStyle: borderStyles,
  scale: radiusScale,
  component: componentRadii,
  borderColor: borderColors,
  focusRing: focusRings,
  divider: dividers,
  stroke: strokeWidths,
}

export default radii
