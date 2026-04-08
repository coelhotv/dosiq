# AP-W02 — Override button size classes with min-height on variant selector

**Category:** Ui
**Status:** active
**Related Rule:** R-119
**Applies To:** all

## Problem

size="sm" and size="md" props stop working, API contract broken, layout regressions

## Prevention

Size-specific heights belong in .btn-sm/.btn-md rules only, NOT in .btn-primary/.btn-secondary. Test all size + variant combos.
