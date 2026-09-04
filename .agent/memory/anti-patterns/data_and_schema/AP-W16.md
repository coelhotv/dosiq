---
title: "`bail: 1` em vitest.critical.config.js mascara múltiplas falhas timezone no mesmo arquivo"
summary: >-
  CI reporta apenas o PRIMEIRO teste que falha; outros testes timezone-dependentes no mesmo arquivo
  fi
layer: warm
status: active
applies_to:
  paths:
    - packages/**
    - "**/schemas/**"
  keywords:
    - bail
    - vitest
    - critical
    - config
    - mascara
    - múltiplas
    - falhas
    - timezone
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W16
incident_count: 2
last_referenced: "2026-05-27"
last_triggered: None
legacy_pack: date-time
related_rule: R-106
tags:
  - ui
  - datetime
trigger_count: 0
---

# AP-W16 — `bail: 1` em vitest.critical.config.js mascara múltiplas falhas timezone no mesmo arquivo

**Category:** Ui
**Status:** active
**Related Rule:** R-106
**Applies To:** all

## Problem

CI reporta apenas o PRIMEIRO teste que falha; outros testes timezone-dependentes no mesmo arquivo ficam ocultos, gerando múltiplos ciclos de fix

## Prevention

Rodar `test:critical` sem bail localmente (ou temporariamente) para revelar TODAS as falhas no arquivo antes de commitar
