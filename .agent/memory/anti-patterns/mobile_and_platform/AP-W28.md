---
title: Cálculo de Meia-Noite Frágil via setHours(24)
summary: Cálculo de meia-noite frágil usando .setHours(24) em vez de .setDate(+1).
layer: warm
status: active
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - useTodayData.js
  keywords:
    - cálculo
    - meia
    - noite
    - frágil
    - via
    - sethours
incident_count: 1
last_referenced: "2026-04-22"
---

# [AP-W28] Cálculo de Meia-Noite Frágil via setHours(24)

## Problema
Uso de `date.setHours(24, 0, 0, 0)` para calcular o início do dia seguinte.

## Sintoma
Comportamento inesperado em algumas engines JavaScript ou durante transições de horário de verão (DST), onde o ajuste de horas pode não saltar o dia corretamente ou resultar em horários duplicados.

## Como Evitar
- Sempre incremente o dia explicitamente via `setDate(getDate() + 1)`.
- Em seguida, zere as horas via `setHours(0, 0, 0, 0)`.

## Caso Real
Identificado pelo revisor Gemini no hook `useTodayData.js` durante a implementação da v0.1.3.
