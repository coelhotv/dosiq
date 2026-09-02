---
title: Ignore timeout warnings on slow tests
summary: Tests >15s can trigger 10-min kill switch in agents, fail CI
layer: cold
status: archived
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - ignore
    - timeout
    - warnings
    - slow
    - tests
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-T09
last_triggered: None
legacy_pack: test-hygiene
related_rule: R-081
tags:
  - testing
  - datetime
  - perf
trigger_count: 0
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
