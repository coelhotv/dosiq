---
title: Barrel exports (`index.js`) que re-exportam todos os services incluindo os de features lazy
summary: >-
  `@shared/services/index.js` exporta `stockService`, `adherenceService`, etc. Qualquer `import { x
  }
layer: cold
status: archived
applies_to:
  paths:
    - apps/mobile/**
  diff_triggers:
    - adherenceService
    - index.js
    - stockService
  keywords:
    - barrel
    - exports
    - index
    - exportam
    - todos
    - services
    - incluindo
    - features
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-B04
incident_count: 1
last_referenced: "2026-03-20"
last_triggered: None
legacy_pack: adherence-reporting-mobile
related_rule: R-117
tags:
  - build
trigger_count: 0
---

# AP-B04 — Barrel exports (`index.js`) que re-exportam todos os services incluindo os de features lazy

**Category:** Build
**Status:** active
**Related Rule:** R-117
**Applies To:** all

## Problem

`@shared/services/index.js` exporta `stockService`, `adherenceService`, etc. Qualquer `import { x } from '@shared/services'` puxa TODA a árvore de dependências para o main bundle, quebrando code-splitting.

## Prevention

Importar services diretamente do arquivo fonte (`from '@stock/services/stockService'`) em vez de barrel exports. Ou dividir barrel em sub-barrels por feature.
