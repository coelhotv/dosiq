---
title: Use raw YYYY-MM-DDT00:00:00 boundaries for UTC timestamptz queries
summary: getTodayLogs com boundaries '2026-04-13T00:00:00' (sem timezone) é tratado como ...
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  keywords:
    - use
    - raw
    - yyyy
    - ddt00
    - boundaries
    - for
    - utc
    - timestamptz
legacy_tags:
  - apps/mobile/src/features/dashboard/services/dashboardService.js
bootstrap_default: false
expiry_date: "2027-04-14"
id: AP-H14
incident_count: 1
last_referenced: "2026-04-13"
last_triggered: "2026-04-14"
legacy_pack: adherence-reporting-mobile
related_rule: R-020
tags:
  - mobile
  - timezone
  - supabase
  - postgrest
  - date
trigger_count: 1
---

getTodayLogs com boundaries '2026-04-13T00:00:00' (sem timezone) é tratado como UTC puro pelo PostgREST. Doses gravadas às 22:30 local (01:30 UTC do dia seguinte) ficam fora do intervalo → logs OK: 0. Usar parseLocalDate(dateStr).toISOString() para boundaries UTC correctas.