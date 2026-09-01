---
title: Logging estruturado em `server/bot/` em vez de em `api/*.js`
summary: >-
  Logs não aparecem em Vercel. Função Node.js server context é invisível para Vercel logging (dois
  pro
layer: warm
status: active
applies_to:
  paths:
    - packages/**
    - "**/schemas/**"
  diff_triggers:
    - createLogger
  keywords:
    - logging
    - estruturado
    - server
    - bot
    - vez
    - api
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-SL01
last_triggered: None
legacy_pack: schema-data
related_rule: R-130
tags:
  - safety
  - api
  - schema
trigger_count: 0
---

# AP-SL01 — Logging estruturado em `server/bot/` em vez de em `api/*.js`

**Category:** Schema
**Status:** active
**Related Rule:** R-130
**Applies To:** all

## Problem

Logs não aparecem em Vercel. Função Node.js server context é invisível para Vercel logging (dois processos/VMs diferentes). Debugging remoto impossível sem visibilidade

## Prevention

Adicionar `createLogger` import em `api/*.js` (Vercel entry point). Logar lá, não em níveis inferiores (server/bot). Logging em `server/bot` é útil para local dev, mas não chega a Vercel prod
