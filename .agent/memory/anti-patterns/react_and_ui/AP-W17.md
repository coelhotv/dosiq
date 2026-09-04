---
title: >-
  Componente com estado interno inicializado de uma prop (`complexityMode`) não reinicializa quando
  a prop muda
summary: >-
  Defaults de expansão de seções ficam presos no valor do primeiro render; UX inconsistente ao mudar
  c
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - complexityMode
  keywords:
    - componente
    - estado
    - interno
    - inicializado
    - prop
    - complexitymode
    - reinicializa
    - muda
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W17
incident_count: 1
last_referenced: "2026-03-05"
last_triggered: None
legacy_pack: react-hooks
related_rule: R-109
tags:
  - ui
  - react
  - interface
trigger_count: 0
---

# AP-W17 — Componente com estado interno inicializado de uma prop (`complexityMode`) não reinicializa quando a prop muda

**Category:** Ui
**Status:** active
**Related Rule:** R-109
**Applies To:** all

## Problem

Defaults de expansão de seções ficam presos no valor do primeiro render; UX inconsistente ao mudar complexidade

## Prevention

Usar `key={controllingProp}` no componente para forçar remount completo quando o prop que define os defaults muda
