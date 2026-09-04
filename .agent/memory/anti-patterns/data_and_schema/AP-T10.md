---
title: Use `new Date()` in tests without timezone awareness
summary: Tests pass in GMT but fail in GMT-3 (local); date off by 1 day
layer: warm
status: active
applies_to:
  paths:
    - packages/**
    - "**/schemas/**"
  keywords:
    - use
    - new
    - date
    - tests
    - without
    - timezone
    - awareness
legacy_tags:
  - all
bootstrap_default: true
expiry_date: "2027-04-08"
id: AP-T10
incident_count: 2
last_referenced: "2026-02-23"
last_triggered: None
legacy_pack: date-time
related_rule: R-020
tags:
  - testing
  - datetime
trigger_count: 0
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
