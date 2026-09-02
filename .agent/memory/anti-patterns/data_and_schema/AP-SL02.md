---
title: Mock/adapter object com interface incompleta
summary: >-
  Handler chama `bot.sendChatAction()` que não existe no mock → `"is not a function"` error em
  produçã
layer: warm
status: active
applies_to:
  paths:
    - packages/**
    - "**/schemas/**"
  keywords:
    - mock
    - adapter
    - object
    - interface
    - incompleta
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-SL02
last_triggered: None
legacy_pack: date-time
related_rule: R-131
tags:
  - safety
  - schema
  - interface
trigger_count: 0
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
