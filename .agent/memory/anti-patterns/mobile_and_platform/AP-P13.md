---
id: AP-P13
title: Disparar queries de background imediatamente após `setIsLoading(false)`
summary: `setIsLoading(false)` permite ao React agendar um render, mas queries disparadas na mesma stack fram
applies_to:
  - all
tags:
  - performance
  - api
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-126
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
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
