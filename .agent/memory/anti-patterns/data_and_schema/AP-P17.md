---
title: "`select('coluna_inexistente')` em query Supabase"
summary: >-
  HTTP 400 Bad Request silencioso. UI mostra "Erro ao carregar dados" sem mensagem clara. Ex:
  `status`
layer: cold
status: archived
applies_to:
  paths:
    - packages/**
    - "**/schemas/**"
  diff_triggers:
    - medicine_logs
  keywords:
    - select
    - coluna_inexistente
    - query
    - supabase
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-P17
last_triggered: None
legacy_pack: schema-data
related_rule: R-089
tags:
  - performance
  - database
  - api
trigger_count: 0
---

# AP-P17 — `select('coluna_inexistente')` em query Supabase

**Category:** Performance
**Status:** active
**Related Rule:** R-089
**Applies To:** all

## Problem

HTTP 400 Bad Request silencioso. UI mostra "Erro ao carregar dados" sem mensagem clara. Ex: `status` em `medicine_logs` não existe

## Prevention

Manter JSDoc sincronizado com schema. Verificar colunas em `docs/architecture/DATABASE.md` antes de adicionar ao select
