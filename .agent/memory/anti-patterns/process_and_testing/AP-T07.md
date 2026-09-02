---
title: Resolve Promise only after assertion without `finally`
summary: If assertion fails, Promise stays pending → Vitest hangs indefinitely
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - resolve
    - promise
    - only
    - after
    - assertion
    - without
    - finally
legacy_tags:
  - all
bootstrap_default: true
expiry_date: "2027-04-08"
id: AP-T07
last_triggered: None
legacy_pack: test-hygiene
related_rule: R-072
tags:
  - safety
  - testing
trigger_count: 0
---

# AP-T07 — Resolve Promise only after assertion without `finally`

**Category:** Testing
**Status:** active
**Related Rule:** R-072
**Applies To:** all

## Problem

If assertion fails, Promise stays pending → Vitest hangs indefinitely

## Prevention

Wrap in `try/finally`: resolve always happens, even on error
