---
title: IntersectionObserver sentinel positioned before fold + rootMargin high
summary: >-
  `rootMargin: '200px'` + sentinel mid-JSX = observer fires immediately on view open → lazy load
  becom
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - rootMargin
  keywords:
    - intersectionobserver
    - sentinel
    - positioned
    - before
    - fold
    - rootmargin
    - high
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P01
incident_count: 1
last_referenced: "2026-03-10"
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-115
tags:
  - performance
  - react
trigger_count: 0
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
