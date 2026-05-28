---
id: AP-P17
title: `select('coluna_inexistente')` em query Supabase
summary: HTTP 400 Bad Request silencioso. UI mostra "Erro ao carregar dados" sem mensagem clara. Ex: `status`
applies_to:
  - all
tags:
  - performance
  - database
  - api
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-089
layer: cold
bootstrap_default: False
pack: schema-data
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
