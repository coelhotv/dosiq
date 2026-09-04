---
title: Skip test cleanup (cache, mocks, timers)
summary: Memory accumulation, OOM on 8GB machines, state leaks between tests
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - skip
    - test
    - cleanup
    - cache
    - mocks
    - timers
legacy_tags:
  - all
bootstrap_default: true
expiry_date: "2027-04-08"
id: AP-T02
incident_count: 0
last_triggered: None
legacy_pack: test-hygiene
related_rule: R-078
tags:
  - testing
  - state
  - datetime
  - perf
trigger_count: 0
---

# AP-T02 — Skip test cleanup (cache, mocks, timers)

**Category:** Testing
**Status:** active
**Related Rule:** R-078
**Applies To:** all

## Problem

Memory accumulation, OOM on 8GB machines, state leaks between tests

## Prevention

Call `afterEach()`: `clearCache()`, `vi.clearAllMocks()`, `vi.clearAllTimers()`, `if (global.gc) global.gc()`
