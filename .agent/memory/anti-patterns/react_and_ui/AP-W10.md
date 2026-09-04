---
title: Export internal sub-components (DoseCard, ZoneSection) from a parent component file
summary: Increases API surface; creates unintended dependencies
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - export
    - internal
    - sub
    - components
    - dosecard
    - zonesection
    - from
    - parent
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W10
incident_count: 1
last_referenced: "2026-03-05"
last_triggered: None
legacy_pack: design-ui
related_rule: R-101
tags:
  - ui
  - api
  - react
trigger_count: 0
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
