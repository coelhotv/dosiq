---
id: AP-P15
title: `new Date()` construction em hot loop (>100 iterações)
summary: `calculateStreaks()` criava ~2700 Date objects (90 dias × N protocolos × 3 calls). Chrome trace: `pa
applies_to:
  - all
tags:
  - performance
  - datetime
  - perf
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-129
layer: warm
bootstrap_default: False
pack: date-time
---

# AP-P15 — `new Date()` construction em hot loop (>100 iterações)

**Category:** Performance
**Status:** active
**Related Rule:** R-129
**Applies To:** all

## Problem

`calculateStreaks()` criava ~2700 Date objects (90 dias × N protocolos × 3 calls). Chrome trace: `parseLocalDate` consumia 71.3% do CPU time (23074/32379 samples), causando 9.5s de freeze no mobile

## Prevention

Strings YYYY-MM-DD são lexicograficamente ordenáveis — usar comparação de strings (`dateStr < startStr`) em vez de `new Date()` para comparações de range
