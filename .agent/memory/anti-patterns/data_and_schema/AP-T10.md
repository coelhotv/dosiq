---
id: AP-T10
title: Use `new Date()` in tests without timezone awareness
summary: Tests pass in GMT but fail in GMT-3 (local); date off by 1 day
applies_to:
  - all
tags:
  - testing
  - datetime
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-020
layer: hot
bootstrap_default: True
pack: date-time
---

# AP-T10 — Use `new Date()` in tests without timezone awareness

**Category:** Testing
**Status:** active
**Related Rule:** R-020
**Applies To:** all

## Problem

Tests pass in GMT but fail in GMT-3 (local); date off by 1 day

## Prevention

Always use `parseLocalDate()` or `new Date(str + 'T00:00:00')` for date comparisons
