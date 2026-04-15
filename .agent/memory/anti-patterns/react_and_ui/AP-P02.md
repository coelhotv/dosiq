---
id: AP-P02
title: Synchronous import of component >200 lines in mobile-critical view
summary: Safari blocks Main Thread 200-400ms for parse/compile before first render (e.g., `SparklineAdesao` 5
applies_to:
  - all
tags:
  - performance
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-116
layer: warm
bootstrap_default: False
pack: design-ui
---

# AP-P02 — Synchronous import of component >200 lines in mobile-critical view

**Category:** Performance
**Status:** active
**Related Rule:** R-116
**Applies To:** all

## Problem

Safari blocks Main Thread 200-400ms for parse/compile before first render (e.g., `SparklineAdesao` 518 ln)

## Prevention

Use `React.lazy()` + `<Suspense fallback>` for components >200 lines in view-level JSX
