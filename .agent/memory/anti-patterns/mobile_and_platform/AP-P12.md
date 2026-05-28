---
id: AP-P12
title: Mesma query Supabase chamada N vezes em sub-funções paralelas
summary: `getAdherenceSummary` chamava 3 sub-funções que cada uma buscava `protocols` independentemente = 3 q
applies_to:
  - all
tags:
  - performance
  - database
  - api
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-125
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-P12 — Mesma query Supabase chamada N vezes em sub-funções paralelas

**Category:** Performance
**Status:** active
**Related Rule:** R-125
**Applies To:** all

## Problem

`getAdherenceSummary` chamava 3 sub-funções que cada uma buscava `protocols` independentemente = 3 queries idênticas em `Promise.allSettled`

## Prevention

Buscar dados compartilhados UMA VEZ na função orquestradora e passar como parâmetro para as sub-funções
