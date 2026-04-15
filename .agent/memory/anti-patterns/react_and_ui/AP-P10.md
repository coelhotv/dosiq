---
id: AP-P10
title: `select('*')` when only need count
summary: All columns transferred unnecessarily. 90 days logs × 10 protocols = ~2700 rows × ~500 bytes/row = 1
applies_to:
  - all
tags:
  - performance
  - api
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-119
layer: warm
bootstrap_default: False
pack: design-ui
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
