---
title: Global Brand Leak
summary: >-
  Global Brand Leak: Applying brand-specific aesthetic tokens (Comfortaa, mint backgrounds) to
  global UI keys causes UX fatigue and readability issues in the main app product.
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - bg.screen
  keywords:
    - global
    - brand
    - leak
---

# [AP-H22] Global Brand Leak

## Symptom
Users report that the app "looks beautiful but is hard to use" after a branding update. Specific issues include text being too wide (Comfortaa in lists), eye fatigue due to lack of high-contrast backgrounds, and general loss of "clinical/clean" feel in the product's core functional areas.

## Cause
Applying brand-specific aesthetic tokens directly to global CSS variables or design system keys (`primary`, `regular font`, `bg.screen`).

## Why it's a Problem
1. **Readability**: Display fonts (like Comfortaa) are designed for headlines, not for reading dense medical lists or dosages.
2. **Context**: Therapeutic environments benefit from neutral, calm surfaces. Constant branding immersion can feel cluttered.
3. **Rigidity**: If the logo font changes, the entire app's readability is put at risk.

## Fix
Revert global UI keys to neutral/system defaults and use specific `brand` tokens ONLY for identity elements (Wordmark, Logo background, Splash).
