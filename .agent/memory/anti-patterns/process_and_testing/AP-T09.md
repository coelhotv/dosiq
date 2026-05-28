---
id: AP-T09
title: Ignore timeout warnings on slow tests
summary: Tests >15s can trigger 10-min kill switch in agents, fail CI
applies_to:
  - all
tags:
  - testing
  - datetime
  - perf
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-081
layer: cold
bootstrap_default: False
pack: test-hygiene
---

# AP-T09 — Ignore timeout warnings on slow tests

**Category:** Testing
**Status:** active
**Related Rule:** R-081
**Applies To:** all

## Problem

Tests >15s can trigger 10-min kill switch in agents, fail CI

## Prevention

Optimize slow tests: mock expensive operations, use fake timers, reduce setup overhead
