---
title: "N+1 Query Pattern: `Promise.all(items.map(async item => supabase.from('table').select()))`"
summary: >-
  N queries Supabase simultaneous. With 10 items → 10 round-trips HTTP, each blocking Main Thread.
  100
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - query
    - pattern
    - promise
    - all
    - items
    - map
    - async
    - item
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P09
incident_count: 1
last_referenced: "2026-03-13"
last_triggered: None
legacy_pack: design-ui
related_rule: R-118
tags:
  - performance
  - database
  - api
trigger_count: 0
---

# AP-P09 — N+1 Query Pattern: `Promise.all(items.map(async item => supabase.from('table').select()))`

**Category:** Performance
**Status:** active
**Related Rule:** R-118
**Applies To:** all

## Problem

N queries Supabase simultaneous. With 10 items → 10 round-trips HTTP, each blocking Main Thread. 100ms+ blocking (safari trace M7). With `select('*')` each = ~500 bytes × 10 = 5KB waste per call

## Prevention

Batch query: 1 `SELECT key` for all items, then `Map.set(key, count)` client-side O(M) grouping. Eliminates round-trip amplification
