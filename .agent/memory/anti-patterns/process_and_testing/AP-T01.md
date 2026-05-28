---
id: AP-T01
title: Use parallel threads (>1) without testing for race conditions
summary: Tests pass locally, fail in CI; unpredictable hangs
applies_to:
  - all
tags:
  - testing
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-081
layer: warm
bootstrap_default: False
pack: test-hygiene
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
