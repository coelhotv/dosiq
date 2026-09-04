---
title: Disparar queries de background imediatamente após `setIsLoading(false)`
summary: >-
  `setIsLoading(false)` permite ao React agendar um render, mas queries disparadas na mesma stack
  fram
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - requestIdleCallback
  keywords:
    - disparar
    - queries
    - background
    - imediatamente
    - após
    - setisloading
    - "false"
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P13
incident_count: 1
last_referenced: "2026-03-15"
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-126
tags:
  - performance
  - api
  - react
trigger_count: 0
---

# AP-P13 — Disparar queries de background imediatamente após `setIsLoading(false)`

**Category:** Performance
**Status:** active
**Related Rule:** R-126
**Applies To:** all

## Problem

`setIsLoading(false)` permite ao React agendar um render, mas queries disparadas na mesma stack frame competem com o paint por HTTP/2 connection slots. Safari mobile pool: 4-6 slots. Com 12+ requests → main thread bloqueia → browser trava completamente

## Prevention

Usar `requestIdleCallback` (ou `setTimeout(100ms)` no Safari) para deferir queries não urgentes APÓS o browser completar o paint
