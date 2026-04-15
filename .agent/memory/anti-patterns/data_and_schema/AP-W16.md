---
id: AP-W16
title: `bail: 1` em vitest.critical.config.js mascara múltiplas falhas timezone no mesmo arquivo
summary: CI reporta apenas o PRIMEIRO teste que falha; outros testes timezone-dependentes no mesmo arquivo fi
applies_to:
  - all
tags:
  - ui
  - datetime
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-106
layer: warm
bootstrap_default: False
pack: date-time
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
