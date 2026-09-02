---
title: Synchronous import of component >200 lines in mobile-critical view
summary: >-
  Safari blocks Main Thread 200-400ms for parse/compile before first render (e.g., `SparklineAdesao`
  5
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - SparklineAdesao
  keywords:
    - synchronous
    - import
    - component
    - lines
    - mobile
    - critical
    - view
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P02
last_triggered: None
legacy_pack: design-ui
related_rule: R-116
tags:
  - performance
  - react
trigger_count: 0
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
