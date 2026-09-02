---
title: Override button size classes with min-height on variant selector
summary: size="sm" and size="md" props stop working, API contract broken, layout regressions
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - override
    - button
    - size
    - classes
    - with
    - min
    - height
    - variant
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W02
last_triggered: None
legacy_pack: design-ui
related_rule: R-119
tags:
  - ui
  - api
  - safety
  - interface
trigger_count: 0
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
