---
id: AP-P14
title: `supabase.auth.getUser()` chamado em cada `getUserId()` sem cache
summary: 13 HTTP roundtrips no primeiro load do Dashboard (~8s em 4G). Cada service que chama `getUserId()` d
applies_to:
  - all
tags:
  - performance
  - database
  - perf
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-128
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
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
