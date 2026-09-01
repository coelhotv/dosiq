---
title: "`supabase.auth.getUser()` chamado em cada `getUserId()` sem cache"
summary: >-
  13 HTTP roundtrips no primeiro load do Dashboard (~8s em 4G). Cada service que chama `getUserId()`
  d
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - onAuthStateChange
  keywords:
    - supabase
    - auth
    - getuser
    - chamado
    - cada
    - getuserid
    - cache
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P14
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-128
tags:
  - performance
  - database
  - perf
trigger_count: 0
---

# AP-P14 — `supabase.auth.getUser()` chamado em cada `getUserId()` sem cache

**Category:** Performance
**Status:** active
**Related Rule:** R-128
**Applies To:** all

## Problem

13 HTTP roundtrips no primeiro load do Dashboard (~8s em 4G). Cada service que chama `getUserId()` dispara um roundtrip independente

## Prevention

Cache em memória + promise coalescence no módulo. Invalidar em `onAuthStateChange` (SIGNED_IN/SIGNED_OUT)
