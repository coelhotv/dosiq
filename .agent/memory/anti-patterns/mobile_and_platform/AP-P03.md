---
id: AP-P03
title: O(n) synchronous computation in useMemo with n>100
summary: `analyzeAdherencePatterns` + Zod validation on 500 objects in useMemo = Main Thread freeze, UI unres
applies_to:
  - all
tags:
  - performance
  - state
  - perf
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-117
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
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
