---
id: AP-W10
title: Export internal sub-components (DoseCard, ZoneSection) from a parent component file
summary: Increases API surface; creates unintended dependencies
applies_to:
  - all
tags:
  - ui
  - api
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-101
layer: warm
bootstrap_default: False
pack: design-ui
---

# AP-W10 — Export internal sub-components (DoseCard, ZoneSection) from a parent component file

**Category:** Ui
**Status:** active
**Related Rule:** R-101
**Applies To:** all

## Problem

Increases API surface; creates unintended dependencies

## Prevention

Keep internal sub-components unexported; only export the public API
