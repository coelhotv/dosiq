---
title: O(n) synchronous computation in useMemo with n>100
summary: >-
  `analyzeAdherencePatterns` + Zod validation on 500 objects in useMemo = Main Thread freeze, UI
  unres
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - analyzeAdherencePatterns
  keywords:
    - synchronous
    - computation
    - usememo
    - with
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P03
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-117
tags:
  - performance
  - state
  - perf
trigger_count: 0
---

# AP-P03 — O(n) synchronous computation in useMemo with n>100

**Category:** Performance
**Status:** active
**Related Rule:** R-117
**Applies To:** all

## Problem

`analyzeAdherencePatterns` + Zod validation on 500 objects in useMemo = Main Thread freeze, UI unresponsive 200-400ms

## Prevention

Wrap in `startTransition(() => { setState(heavyComputation()) })` to allow React to pause between frames
