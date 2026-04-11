/**
 * Sanctuary Design System Tokens — Main Export
 *
 * Pure JavaScript/JSON design tokens for the Meus Remédios design system.
 * Provides platform-agnostic token values for consumption by:
 * - Web (React + CSS)
 * - Mobile (React Native)
 *
 * IMPORTANT: This package contains NO runtime dependencies, NO browser APIs, and NO platform-specific code.
 *
 * Usage:
 *
 *   // Import all tokens
 *   import { colors, spacing, radii, typography } from '@meus-remedios/design-tokens'
 *
 *   // Import specific category
 *   import { colors } from '@meus-remedios/design-tokens/colors'
 *   import { spacing } from '@meus-remedios/design-tokens/spacing'
 *
 * @module @meus-remedios/design-tokens
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
