# AP-H26: Missing Style Tokens Import in React Native Components

## Context
When performing UI standardizations or mass-refactoring of color/spacing, agents often use theme tokens (`colors.x`, `spacing.y`) within `StyleSheet.create`. If the import is missing, it results in a critical runtime crash in the JS Engine (Hermes).

## Symptom
Application crashes immediately upon entering the screen with:
`ReferenceError: Property 'colors' doesn't exist`
or
`Invariant Violation: "main" has not been registered.`

## Why this happens
Unlike web development where global CSS or Tailwind handles standard colors, standardizing Native UI requires explicit imports of the `tokens.js` file. Agents focused on the visual logic easily overlook the top-level imports when modifying existing files.

## How to avoid
1. **Always Check Imports**: Before using `colors` or `spacing` in a component, verify that they are imported from `@shared/styles/tokens`.
2. **Standard Boilerplate**: If `StyleSheet.create` uses common tokens, ensure the import line exists:
   `import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'`
3. **Verify via Lint**: Run `npm run lint` before committing. ESLint should flag `colors is not defined`.
   > **Note**: If the agent bypasses lint or if the linter doesn't catch it due to specific configuration, the error will only appear at runtime.

## Correct Pattern
```javascript
import { colors, spacing } from '../../../shared/styles/tokens'

const styles = StyleSheet.create({
  title: {
    color: colors.text.primary, // Safe usage
    padding: spacing[4],
  }
})
```
