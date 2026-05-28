---
id: AP-B04
title: Barrel exports (`index.js`) que re-exportam todos os services incluindo os de features lazy
summary: `@shared/services/index.js` exporta `stockService`, `adherenceService`, etc. Qualquer `import { x } 
applies_to:
  - all
tags:
  - build
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-117
layer: cold
bootstrap_default: False
pack: adherence-reporting-mobile
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
