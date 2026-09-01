---
title: Mesma query Supabase chamada N vezes em sub-funções paralelas
summary: >-
  `getAdherenceSummary` chamava 3 sub-funções que cada uma buscava `protocols` independentemente = 3
  q
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - getAdherenceSummary
    - Promise.allSettled
  keywords:
    - mesma
    - query
    - supabase
    - chamada
    - vezes
    - sub
    - funções
    - paralelas
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P12
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-125
tags:
  - performance
  - database
  - api
trigger_count: 0
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
