---
title: Leave dead code (old states, memos, handlers) after replacing a JSX section
summary: CI lint failure; confuses future agents about what is active
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - leave
    - dead
    - code
    - old
    - states
    - memos
    - handlers
    - after
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W13
incident_count: 1
last_referenced: "2026-03-05"
last_triggered: None
legacy_pack: design-ui
related_rule: R-105
tags:
  - safety
  - ui
  - state
  - react
trigger_count: 0
---

# AP-W13 — Leave dead code (old states, memos, handlers) after replacing a JSX section

**Category:** Ui
**Status:** active
**Related Rule:** R-105
**Applies To:** all

## Problem

CI lint failure; confuses future agents about what is active

## Prevention

Run `grep -n "NomeVarAntiga"` post-replacement; `npm run lint` before commit
