# @meus-remedios/design-tokens

Design system tokens for Meus Remédios (Sanctuary Design System).

Pure JavaScript/JSON tokens with zero runtime dependencies, safe for all platforms:
- Web (React + Vite)
- Mobile (React Native)
- Node.js / server-side

## Installation

Included in monorepo workspace. Use npm workspaces:

```bash
npm install
```

## Usage

### Import all tokens

```javascript
import { colors, spacing, radii, typography } from '@meus-remedios/design-tokens'

const bgColor = colors.background.bgPrimary
const padding = spacing.named.md
const radius = radii.component.cardMd
const fontSize = typography.fontSizes.base
```

### Import specific category

```javascript
// Colors only
import { colors } from '@meus-remedios/design-tokens/colors'

// Spacing only
import { spacing } from '@meus-remedios/design-tokens/spacing'

// Radii only
import { radii } from '@meus-remedios/design-tokens/radii'

// Typography only
import { typography } from '@meus-remedios/design-tokens/typography'
```

## Token Structure

### colors.js

- `brand` — Primary (pink) and secondary (cyan) brand colors
- `status` — Success, warning, error, info semantic colors
- `background` — Background layers (primary, secondary, tertiary, card, overlay, glass)
- `text` — Text colors (primary, secondary, tertiary, inverse, link)
- `border` — Border colors (light, default, dark)
- `theme` — Toggle and theme colors (sun, moon)
- `healthScore` — Health score colors (critical, low, medium, good, excellent)
- `glow` — Glow effects (cyan, pink, magenta, green, success, warning, error, info)
- `state` — State colors (hover, active, focus, disabled, loading)
- `opacity` — Opacity values (disabled, hover, focus, overlay, backdrop)
- `glassmorphism` — Glassmorphism levels (light, default, heavy, hero)
- `gradients` — Gradient backgrounds (insight, hero, alert, success)
- `darkMode` — Dark theme overrides

### spacing.js

- `scale` — Raw spacing scale (space-0 through space-96)
- `named` — Named semantic spacing (xs, sm, md, lg, xl, 2xl)
- `hierarchical` — Hierarchical spacing (sections, components, lists)
- `breakpoints` — Responsive breakpoints (xs, sm, md, lg, xl, 2xl)
- `containers` — Container widths
- `section` — Section-level spacing
- `component` — Component spacing (cards, buttons, inputs, modals)
- `layout` — Layout spacing (grid, flex, page)
- `navigation` — Navigation spacing
- `safeArea` — Safe area insets (for notched devices)

### radii.js

- `borderWidth` — Border width values (thin, default, medium, thick, heavy)
- `borderStyle` — Border styles (solid, dashed, dotted)
- `scale` — Border radius scale (none through full)
- `component` — Component-specific radii (hero, card, pill, input, button, circle, avatar)
- `borderColor` — Border colors
- `focusRing` — Focus ring configuration
- `divider` — Divider/separator styles
- `stroke` — SVG stroke widths

### typography.js

- `fontFamilies` — Primary system font and monospace font
- `fontSizes` — Font size scale (2xs through 5xl)
- `fontWeights` — Font weight values (thin through black)
- `lineHeights` — Line height scale (none through loose)
- `letterSpacing` — Letter spacing values (tighter through widest)
- `textDefaults` — Default text color and decoration
- `headingDefaults` — Default heading font, weight, line height
- `headingStyles` — Heading-specific styles (h1 through h6)
- `textScales` — Text utility scales (label, caption, body, button)

## Design Principles

### DT-001: Tokens are pure JS/JSON

No CSS custom properties, no StyleSheet objects, no platform-specific code.

### DT-002: No CSS in this package

CSS custom property generation is the responsibility of each platform (web, mobile).

### DT-003: No StyleSheet in this package

React Native StyleSheet creation is the responsibility of the mobile app.

### DT-004: Motion language is platform-specific

Framer Motion (web) and Reanimated (mobile) have separate implementations.

### DT-005: Web is source of truth

Token values are extracted from `src/shared/styles/` (Sanctuary Design System).

## Synchronization

If tokens change in the web design system (`src/shared/styles/`), update this package:

```bash
# 1. Update token values in colors.js, spacing.js, radii.js, typography.js
# 2. Test the package
npm run test
# 3. Commit and push
git add packages/design-tokens
git commit -m "feat(design-tokens): update [category] values"
```

Mobile apps receive updates automatically via workspace dependency resolution.

## Testing

```bash
# Test all packages (from root)
npm run test

# Test this package specifically
npm run test -- packages/design-tokens
```

## No External Dependencies

This package has **zero npm dependencies**. All tokens are pure data structures.

### What's NOT included

- ❌ React
- ❌ React Native
- ❌ Zod
- ❌ Any runtime library

### What IS included

- ✅ Pure JavaScript objects
- ✅ Standard color, size, and weight values
- ✅ Platform-agnostic token structure

## Platform Integration

### Web

Use tokens to generate CSS custom properties:

```javascript
import { colors, spacing } from '@meus-remedios/design-tokens'

// In a CSS-in-JS or Vite plugin:
const cssVars = Object.entries(colors.brand).reduce(
  (acc, [key, value]) => ({
    ...acc,
    [`--brand-${key}`]: value,
  }),
  {}
)
```

### Mobile

Use tokens directly in React Native StyleSheet:

```javascript
import { colors, spacing } from '@meus-remedios/design-tokens'
import { StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.bgPrimary,
    padding: parseInt(spacing.named.md),
  },
})
```

## License

MIT
