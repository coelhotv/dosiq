---
title: Set `strokeDashoffset` only in Framer Motion `initial`/`animate` without `style`
summary: Flash of full/empty ring before animation starts (browser renders default value)
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - strokeDashoffset
  keywords:
    - set
    - strokedashoffset
    - only
    - framer
    - motion
    - initial
    - animate
    - without
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W05
last_triggered: None
legacy_pack: design-ui
related_rule: R-096
tags:
  - ui
  - styling
trigger_count: 0
---

# AP-W05 — Set `strokeDashoffset` only in Framer Motion `initial`/`animate` without `style`

**Category:** Ui
**Status:** active
**Related Rule:** R-096
**Applies To:** all

## Problem

Flash of full/empty ring before animation starts (browser renders default value)

## Prevention

Set `strokeDashoffset` in both `style` (static) and `initial`/`animate` (animated)
