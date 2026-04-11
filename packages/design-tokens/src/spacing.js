/**
 * Spacing Tokens — Sanctuary Design System
 *
 * Pure JavaScript object containing all spacing values, breakpoints, and layout tokens.
 * Extracted from src/shared/styles/tokens/spacing.css
 *
 * These tokens are platform-agnostic and can be consumed by:
 * - Web (CSS custom properties or direct string values with rem units)
 * - Mobile (React Native dimensions and spacing)
 *
 * IMPORTANT NOTE ON UNITS:
 * - Values use 'rem' which is relative to browser's root font-size (default 16px)
 * - React Native does NOT understand 'rem' or 'px' CSS units
 * - For mobile consumption, convert: parseInt(value) or multiply by base font-size (16)
 * - Example: '1rem' = 16 pixels; '0.5rem' = 8 pixels
 * - Mobile StyleSheet should parse: const px = parseFloat(value) * 16 // assuming 16px root
 *
 * @module @meus-remedios/design-tokens/spacing
 */

// ============================================
// SPACING SCALE - Based on Tailwind CSS (in rem units)
// ============================================
// NOTE: All values use 'rem' units (relative to 16px root font-size).
// For mobile/React Native, convert rem to pixels: value_px = rem_multiplier * 16
// Examples: '0.25rem' = 4px, '1rem' = 16px, '2rem' = 32px
const spaceScale = {
  0: '0',
  px: '1px',
  '0.5': '0.125rem',
  1: '0.25rem',
  '1.5': '0.375rem',
  2: '0.5rem',
  '2.5': '0.625rem',
  3: '0.75rem',
  '3.5': '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  9: '2.25rem',
  10: '2.5rem',
  11: '2.75rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  28: '7rem',
  32: '8rem',
  36: '9rem',
  40: '10rem',
  44: '11rem',
  48: '12rem',
  52: '13rem',
  56: '14rem',
  60: '15rem',
  64: '16rem',
  72: '18rem',
  80: '20rem',
  96: '24rem',
}

// ============================================
// NAMED SPACING TOKENS (semantic names)
// ============================================
const namedSpacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
}

// ============================================
// HIERARCHICAL SPACING - Mobile First
// ============================================
const hierarchicalSpacing = {
  sectionHero: '1.5rem',
  sectionMajor: '1rem',
  sectionMinor: '0.75rem',
  sectionTight: '0.5rem',

  componentLoose: '1rem',
  componentNormal: '0.75rem',
  componentCompact: '0.5rem',
  componentTight: '0.25rem',

  listLoose: '0.75rem',
  listNormal: '0.5rem',
  listCompact: '0.25rem',

  related: '0.25rem',
  relatedTight: '2px',
}

// ============================================
// RESPONSIVE BREAKPOINTS
// ============================================
const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',

  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
}

// ============================================
// CONTAINER WIDTHS
// ============================================
const containerWidths = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  full: '100%',
}

// ============================================
// SECTION SPACING - Mobile First
// ============================================
const sectionSpacing = {
  paddingY: '1rem',
  paddingX: '0.75rem',
  marginY: '1rem',
  compactPaddingY: '0.75rem',
  compactPaddingX: '0.5rem',
}

// ============================================
// COMPONENT SPACING - Cards Mobile First
// ============================================
const componentSpacing = {
  card: {
    padding: '0.75rem',
    paddingSm: '0.5rem',
    paddingLg: '1rem',
    gap: '0.5rem',
    borderRadius: '0.75rem',
  },
  button: {
    paddingY: '0.5rem',
    paddingX: '1rem',
    paddingYSm: '0.25rem',
    paddingXSm: '0.75rem',
    paddingYLg: '0.75rem',
    paddingXLg: '1.5rem',
    gap: '0.5rem',
  },
  input: {
    paddingY: '0.5rem',
    paddingX: '0.75rem',
    gap: '0.5rem',
  },
  listItem: {
    paddingY: '0.75rem',
    paddingX: '1rem',
  },
  listGap: '0.5rem',
  modal: {
    padding: '1.5rem',
    gap: '1rem',
    headerHeight: '4rem',
    footerHeight: '4rem',
  },
}

// ============================================
// LAYOUT SPACING
// ============================================
const layoutSpacing = {
  grid: {
    gap: '1.5rem',
    gapSm: '1rem',
    gapLg: '2rem',
  },
  flex: {
    gap: '1rem',
    gapSm: '0.5rem',
    gapLg: '1.5rem',
  },
  page: {
    margin: '1rem',
    padding: '1.5rem',
    maxWidth: '1280px',
  },
}

// ============================================
// NAVIGATION SPACING
// ============================================
const navigationSpacing = {
  height: '4rem',
  heightCompact: '3.5rem',
  padding: '1rem',
  itemPadding: '0.75rem',
  iconSize: '1.5rem',
}

// ============================================
// SAFE AREA INSETS (for notched devices)
// ============================================
const safeAreaInsets = {
  top: '0px',
  right: '0px',
  bottom: '0px',
  left: '0px',
}

// ============================================
// MAIN EXPORTS
// ============================================
export const spacing = {
  scale: spaceScale,
  named: namedSpacing,
  hierarchical: hierarchicalSpacing,
  breakpoints,
  containers: containerWidths,
  section: sectionSpacing,
  component: componentSpacing,
  layout: layoutSpacing,
  navigation: navigationSpacing,
  safeArea: safeAreaInsets,
}

export default spacing
