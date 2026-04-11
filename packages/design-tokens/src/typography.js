/**
 * Typography Tokens — Sanctuary Design System
 *
 * Pure JavaScript object containing all typography values including font families,
 * sizes, weights, and line heights.
 * Extracted from src/shared/styles/tokens/typography.css
 *
 * These tokens are platform-agnostic and can be consumed by:
 * - Web (CSS custom properties)
 * - Mobile (React Native typography / text styles)
 *
 * @module @meus-remedios/design-tokens/typography
 */

// ============================================
// FONT FAMILIES
// ============================================
const fontFamilies = {
  primary:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
}

// ============================================
// FONT SIZES - Based on Tailwind CSS scale
// ============================================
const fontSizes = {
  '2xs': '0.625rem',
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
}

// ============================================
// FONT WEIGHTS
// ============================================
const fontWeights = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
  regular: 400,
}

// ============================================
// LINE HEIGHTS
// ============================================
const lineHeights = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
}

// ============================================
// LETTER SPACING
// ============================================
const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
}

// ============================================
// TEXT DEFAULTS
// ============================================
const textDefaults = {
  colorPrimary: '#111827',
  colorSecondary: '#4b5563',
  colorTertiary: '#6b7280',
  colorInverse: '#ffffff',
  colorLink: '#ec4899',
  decorationNone: 'none',
  decorationUnderline: 'underline',
}

// ============================================
// HEADING DEFAULTS
// ============================================
const headingDefaults = {
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontWeight: 600,
  lineHeight: 1.25,
  letterSpacing: '-0.025em',
}

// ============================================
// HEADING STYLES (H1 - H6)
// ============================================
const headingStyles = {
  h1: {
    size: '2.25rem',
    weight: 700,
  },
  h2: {
    size: '1.875rem',
    weight: 600,
  },
  h3: {
    size: '1.5rem',
    weight: 600,
  },
  h4: {
    size: '1.25rem',
    weight: 500,
  },
  h5: {
    size: '1.125rem',
    weight: 500,
  },
  h6: {
    size: '1rem',
    weight: 500,
  },
}

// ============================================
// TEXT SCALE / UTILITY CLASSES
// ============================================
const textScales = {
  label: {
    size: fontSizes.xs,
    weight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
  },
  caption: {
    size: fontSizes['2xs'],
    weight: fontWeights.normal,
    lineHeight: lineHeights.tight,
  },
  body: {
    size: fontSizes.base,
    weight: fontWeights.normal,
    lineHeight: lineHeights.normal,
  },
  button: {
    size: fontSizes.sm,
    weight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
  },
}

// ============================================
// MAIN EXPORTS
// ============================================
export const typography = {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacing,
  textDefaults,
  headingDefaults,
  headingStyles,
  textScales,
}

export default typography
