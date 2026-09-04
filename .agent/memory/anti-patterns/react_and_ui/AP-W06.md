---
title: Use `color-mix()` CSS without `@supports` fallback
summary: Silent failure on Safari < 16.2; no background color applied
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - use
    - color
    - mix
    - css
    - without
    - supports
    - fallback
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W06
incident_count: 1
last_referenced: "2026-03-05"
last_triggered: None
legacy_pack: design-ui
related_rule: R-097
tags:
  - safety
  - ui
  - styling
trigger_count: 0
---

# AP-W06 — Use `color-mix()` CSS without `@supports` fallback

**Category:** Ui
**Status:** active
**Related Rule:** R-097
**Applies To:** all

## Problem

Silent failure on Safari < 16.2; no background color applied

## Prevention

Always add `@supports not (background: color-mix(...))` with a border fallback
