---
id: AP-SL02
title: Mock/adapter object com interface incompleta
summary: Handler chama `bot.sendChatAction()` que não existe no mock → `"is not a function"` error em produçã
applies_to:
  - all
tags:
  - safety
  - schema
  - interface
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-131
layer: warm
bootstrap_default: False
pack: date-time
---

# AP-SL02 — Mock/adapter object com interface incompleta

**Category:** Schema
**Status:** active
**Related Rule:** R-131
**Applies To:** all

## Problem

Handler chama `bot.sendChatAction()` que não existe no mock → `"is not a function"` error em produção. Testar localmente com bot mock não revela que métodos faltam até atingir a função real

## Prevention

Lista de checkout: todos os `bot.*` chamados em handlers DEVEM estar implementados no mock. Testar localmente com a mesma função de mock antes de deploy
