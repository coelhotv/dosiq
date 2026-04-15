---
id: AP-P16
title: Template UTC hardcoded em queries Supabase: `` `${date}T00:00:00.000Z` ``
summary: Ignora fuso horário local. Em GMT-3 (Brasil), `2026-03-01T00:00:00.000Z` = 21:00 do dia anterior loc
applies_to:
  - all
tags:
  - performance
  - database
  - datetime
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-131
layer: warm
bootstrap_default: False
pack: date-time
---

# AP-P16 — Template UTC hardcoded em queries Supabase: `` `${date}T00:00:00.000Z` ``

**Category:** Performance
**Status:** active
**Related Rule:** R-131
**Applies To:** all

## Problem

Ignora fuso horário local. Em GMT-3 (Brasil), `2026-03-01T00:00:00.000Z` = 21:00 do dia anterior local. Logs do dia 01 às 22:00 BRT ficam de fora

## Prevention

Sempre usar `parseLocalDate(dateStr).toISOString()` para converter data local → UTC corretamente
