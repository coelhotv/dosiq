---
id: AP-P18
title: Hardcode PDF header/card geometry and render long labels with fixed single-line `text()` calls
summary: Title/patient overlap, clipped headers, and layout churn every time content length changes
applies_to:
  - all
tags:
  - performance
  - styling
  - datetime
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-146
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
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
