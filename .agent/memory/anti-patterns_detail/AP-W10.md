# AP-W10 — Export internal sub-components (DoseCard, ZoneSection) from a parent component file

**Category:** Ui
**Status:** active
**Related Rule:** R-101
**Applies To:** all

## Problem

Increases API surface; creates unintended dependencies

## Prevention

Keep internal sub-components unexported; only export the public API
