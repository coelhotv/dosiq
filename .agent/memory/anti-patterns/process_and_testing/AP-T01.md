---
title: Use parallel threads (>1) without testing for race conditions
summary: Tests pass locally, fail in CI; unpredictable hangs
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - use
    - parallel
    - threads
    - without
    - testing
    - for
    - race
    - conditions
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-T01
last_triggered: None
legacy_pack: test-hygiene
related_rule: R-081
tags:
  - testing
trigger_count: 0
---

# AP-T01 — Use parallel threads (>1) without testing for race conditions

**Category:** Testing
**Status:** active
**Related Rule:** R-081
**Applies To:** all

## Problem

Tests pass locally, fail in CI; unpredictable hangs

## Prevention

Default: 1 thread (`npm run test:fast`). Use `--maxThreads=2` only if test isolation verified
