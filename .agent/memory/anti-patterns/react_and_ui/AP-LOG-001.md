---
title: Unfiltered `console.log()` statements in production UI code
summary: >-
  50+ debug logs on Dashboard load polluteDevTools, confuse users, create noise that hides real
  errors
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - unfiltered
    - console
    - log
    - statements
    - production
    - code
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-LOG-001
incident_count: 5
last_referenced: "2026-09-03"
last_triggered: None
legacy_pack: design-ui
related_rule: R-116
tags:
  - safety
  - state
  - logging
trigger_count: 0
---

# AP-LOG-001 — Unfiltered `console.log()` statements in production UI code

**Category:** Logging
**Status:** active
**Related Rule:** R-116
**Applies To:** all

## Problem

50+ debug logs on Dashboard load polluteDevTools, confuse users, create noise that hides real errors. Makes troubleshooting harder (signal-to-noise ratio 1:50). Logs like "Processando 7 registros" add zero value

## Prevention

Always use `debugLog()` helper that checks `process.env.NODE_ENV === 'development'`. Remove logs that are "obvious" (e.g., "rendering component"). Keep only logs that help diagnose real issues. Log should provide actionable info
