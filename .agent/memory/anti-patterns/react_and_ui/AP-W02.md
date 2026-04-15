---
id: AP-W02
title: Override button size classes with min-height on variant selector
summary: size="sm" and size="md" props stop working, API contract broken, layout regressions
applies_to:
  - all
tags:
  - ui
  - api
  - safety
  - interface
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-119
layer: warm
bootstrap_default: False
pack: design-ui
---

# AP-W02 — Override button size classes with min-height on variant selector

**Category:** Ui
**Status:** active
**Related Rule:** R-119
**Applies To:** all

## Problem

size="sm" and size="md" props stop working, API contract broken, layout regressions

## Prevention

Size-specific heights belong in .btn-sm/.btn-md rules only, NOT in .btn-primary/.btn-secondary. Test all size + variant combos.
