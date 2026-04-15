---
id: AP-T07
title: Resolve Promise only after assertion without `finally`
summary: If assertion fails, Promise stays pending → Vitest hangs indefinitely
applies_to:
  - all
tags:
  - safety
  - testing
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-072
layer: hot
bootstrap_default: True
pack: test-hygiene
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
