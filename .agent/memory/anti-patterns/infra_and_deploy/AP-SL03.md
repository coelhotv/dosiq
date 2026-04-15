---
id: AP-SL03
title: Message router sem fallback para casos não-capturados
summary: Listeners específicos (com patterns/sessão) capturam algumas mensagens, outras caem silenciosamente.
applies_to:
  - all
tags:
  - schema
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: active
related_rule: R-132
layer: warm
bootstrap_default: False
pack: infra-api
---

# AP-SL03 — Message router sem fallback para casos não-capturados

**Category:** Schema
**Status:** active
**Related Rule:** R-132
**Applies To:** all

## Problem

Listeners específicos (com patterns/sessão) capturam algumas mensagens, outras caem silenciosamente. Usuário envia texto livre → nenhum handler responde → sem feedback

## Prevention

Event-driven routers SEMPRE precisam de `else` catch-all. Se múltiplos `bot.on()` listeners, último deve ser fallback genérico com logging
