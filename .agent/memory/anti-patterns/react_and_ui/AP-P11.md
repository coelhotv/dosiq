---
id: AP-P11
title: `useCallback` with state in deps of a ref callback
summary: Ref callbacks recreated on state change. React calls `old(null)` without cleanup → `new(element)` wi
applies_to:
  - all
tags:
  - performance
  - state
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-120
layer: warm
bootstrap_default: False
pack: design-ui
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
