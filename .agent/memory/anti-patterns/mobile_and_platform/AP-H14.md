---
id: AP-H14
title: Use raw YYYY-MM-DDT00:00:00 boundaries for UTC timestamptz queries
summary: getTodayLogs com boundaries '2026-04-13T00:00:00' (sem timezone) é tratado como UTC puro pelo PostgREST. Doses gravadas às 22:30 local (01:30 UTC do dia seguinte) ficam fora do intervalo → logs OK: 0. Usar parseLocalDate(dateStr).toISOString() para boundaries UTC correctas.
applies_to:
  - apps/mobile/src/features/dashboard/services/dashboardService.js
tags:
  - mobile
  - timezone
  - supabase
  - postgrest
  - date
trigger_count: 1
last_triggered: 2026-04-14
expiry_date: 2027-04-14
status: active
related_rule: R-020
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

getTodayLogs com boundaries '2026-04-13T00:00:00' (sem timezone) é tratado como UTC puro pelo PostgREST. Doses gravadas às 22:30 local (01:30 UTC do dia seguinte) ficam fora do intervalo → logs OK: 0. Usar parseLocalDate(dateStr).toISOString() para boundaries UTC correctas.