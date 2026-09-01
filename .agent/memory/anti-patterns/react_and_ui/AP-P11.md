---
title: "`useCallback` with state in deps of a ref callback"
summary: >-
  Ref callbacks recreated on state change. React calls `old(null)` without cleanup → `new(element)`
  wi
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - useCallback
  keywords:
    - usecallback
    - with
    - state
    - deps
    - ref
    - callback
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P11
last_triggered: None
legacy_pack: design-ui
related_rule: R-120
tags:
  - performance
  - state
  - react
trigger_count: 0
---

# AP-P11 — `useCallback` with state in deps of a ref callback

**Category:** Performance
**Status:** active
**Related Rule:** R-120
**Applies To:** all

## Problem

Ref callbacks recreated on state change. React calls `old(null)` without cleanup → `new(element)` with new observer. 16ms window with two observers. Leads to duplicate event fires or race conditions

## Prevention

Ref callbacks ALWAYS deps `[]`. Use `useRef` for stateful flags that would need closure. Return value of ref callback is ignored (only useEffect cleanup runs)
