---
id: AP-P01
title: IntersectionObserver sentinel positioned before fold + rootMargin high
summary: `rootMargin: '200px'` + sentinel mid-JSX = observer fires immediately on view open → lazy load becom
applies_to:
  - all
tags:
  - performance
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-115
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-P01 — IntersectionObserver sentinel positioned before fold + rootMargin high

**Category:** Performance
**Status:** active
**Related Rule:** R-115
**Applies To:** all

## Problem

`rootMargin: '200px'` + sentinel mid-JSX = observer fires immediately on view open → lazy load becomes eager load

## Prevention

Position sentinel AFTER all visible content (end of JSX); reduce `rootMargin` to `<= 50px`
