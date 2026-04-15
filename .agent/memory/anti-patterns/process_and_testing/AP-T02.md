---
id: AP-T02
title: Skip test cleanup (cache, mocks, timers)
summary: Memory accumulation, OOM on 8GB machines, state leaks between tests
applies_to:
  - all
tags:
  - testing
  - state
  - datetime
  - perf
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-078
layer: hot
bootstrap_default: True
pack: test-hygiene
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
