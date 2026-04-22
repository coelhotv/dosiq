/**
 * Sanctuary Design System Tokens — Main Export
 *
 * Pure JavaScript/JSON design tokens for the Dosiq design system.
 * Provides platform-agnostic token values for consumption by:
 * - Web (React + CSS)
 * - Mobile (React Native)
 *
 * IMPORTANT: This package contains NO runtime dependencies, NO browser APIs, and NO platform-specific code.
 *
 * Usage:
 *
 *   // Import all tokens
 *   import { colors, spacing, radii, typography } from '@dosiq/design-tokens'
 *
 *   // Import specific category
 *   import { colors } from '@dosiq/design-tokens/colors'
 *   import { spacing } from '@dosiq/design-tokens/spacing'
 *
 * @module @dosiq/design-tokens
 */

export { colors } from './colors.js'
export { spacing } from './spacing.js'
export { radii } from './radii.js'
export { typography } from './typography.js'

// Barrel export for convenience
import { colors } from './colors.js'
import { spacing } from './spacing.js'
import { radii } from './radii.js'
import { typography } from './typography.js'

export const designTokens = {
  colors,
  spacing,
  radii,
  typography,
}

export default designTokens
