# AP-W05 — Set `strokeDashoffset` only in Framer Motion `initial`/`animate` without `style`

**Category:** Ui
**Status:** active
**Related Rule:** R-096
**Applies To:** all

## Problem

Flash of full/empty ring before animation starts (browser renders default value)

## Prevention

Set `strokeDashoffset` in both `style` (static) and `initial`/`animate` (animated)
