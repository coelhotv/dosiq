---
title: Message router sem fallback para casos não-capturados
summary: >-
  Listeners específicos (com patterns/sessão) capturam algumas mensagens, outras caem
  silenciosamente.
layer: warm
status: active
applies_to:
  paths:
    - api/**
  keywords:
    - message
    - router
    - fallback
    - casos
    - capturados
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-SL03
last_triggered: None
legacy_pack: infra-api
related_rule: R-132
tags:
  - schema
trigger_count: 0
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
