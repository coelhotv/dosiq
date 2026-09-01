---
title: Hardcode PDF header/card geometry and render long labels with fixed single-line `text()` calls
summary: Title/patient overlap, clipped headers, and layout churn every time content length changes
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  keywords:
    - hardcode
    - pdf
    - header
    - card
    - geometry
    - render
    - long
    - labels
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P18
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-146
tags:
  - performance
  - styling
  - datetime
trigger_count: 0
---

# AP-P18 — Hardcode PDF header/card geometry and render long labels with fixed single-line `text()` calls

**Category:** Performance
**Status:** active
**Related Rule:** R-146
**Applies To:** all

## Problem

Title/patient overlap, clipped headers, and layout churn every time content length changes

## Prevention

Centralize layout constants and use `splitTextToSize()` or explicit width limits for any header/title/patient block
