---
id: AP-T06
title: Hardcode `setTimeout()` for timing in `act()` blocks
summary: Timing-dependent, flaky in CI; can timeout unexpectedly
applies_to:
  - all
tags:
  - testing
  - datetime
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-073
layer: hot
bootstrap_default: True
pack: test-hygiene
---

# AP-T06 — Hardcode `setTimeout()` for timing in `act()` blocks

**Category:** Testing
**Status:** active
**Related Rule:** R-073
**Applies To:** all

## Problem

Timing-dependent, flaky in CI; can timeout unexpectedly

## Prevention

Use `vi.useFakeTimers()` + `vi.runAllTimersAsync()` OR `waitFor()` polling (no hardcoded delays)
