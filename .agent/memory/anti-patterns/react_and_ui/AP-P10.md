---
title: "`select('*')` when only need count"
summary: >-
  All columns transferred unnecessarily. 90 days logs × 10 protocols = ~2700 rows × ~500 bytes/row =
  1
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - select
    - when
    - only
    - need
    - count
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P10
last_triggered: None
legacy_pack: design-ui
related_rule: R-119
tags:
  - performance
  - api
trigger_count: 0
---

# AP-P10 — `select('*')` when only need count

**Category:** Performance
**Status:** active
**Related Rule:** R-119
**Applies To:** all

## Problem

All columns transferred unnecessarily. 90 days logs × 10 protocols = ~2700 rows × ~500 bytes/row = 1.35MB waste per query

## Prevention

Use `select('*', { count: 'exact', head: true })` — HEAD request, zero data bytes, server returns only count
