---
title: Hardcode `setTimeout()` for timing in `act()` blocks
summary: Timing-dependent, flaky in CI; can timeout unexpectedly
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - hardcode
    - settimeout
    - for
    - timing
    - act
    - blocks
legacy_tags:
  - all
bootstrap_default: true
expiry_date: "2027-04-08"
id: AP-T06
incident_count: 0
last_triggered: None
legacy_pack: test-hygiene
related_rule: R-073
tags:
  - testing
  - datetime
trigger_count: 0
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
