---
id: AP-W05
title: Set `strokeDashoffset` only in Framer Motion `initial`/`animate` without `style`
summary: Flash of full/empty ring before animation starts (browser renders default value)
applies_to:
  - all
tags:
  - ui
  - styling
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-096
layer: warm
bootstrap_default: False
pack: design-ui
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
