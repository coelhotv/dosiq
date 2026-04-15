---
id: AP-W06
title: Use `color-mix()` CSS without `@supports` fallback
summary: Silent failure on Safari < 16.2; no background color applied
applies_to:
  - all
tags:
  - safety
  - ui
  - styling
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-097
layer: warm
bootstrap_default: False
pack: design-ui
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
