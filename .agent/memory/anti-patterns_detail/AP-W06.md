# AP-W06 — Use `color-mix()` CSS without `@supports` fallback

**Category:** Ui
**Status:** active
**Related Rule:** R-097
**Applies To:** all

## Problem

Silent failure on Safari < 16.2; no background color applied

## Prevention

Always add `@supports not (background: color-mix(...))` with a border fallback
