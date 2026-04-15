---
id: AP-B02
title: Selecionar coluna inexistente em query Supabase (ex: `status` em `medicine_logs`)
summary: HTTP 400 Bad Request + `[QueryCache] Fetch falhou` em toda abertura da view afetada. UI mostra "Erro
applies_to:
  - all
tags:
  - perf
  - database
  - build
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

# AP-B02 — Selecionar coluna inexistente em query Supabase (ex: `status` em `medicine_logs`)

**Category:** Build
**Status:** active
**Related Rule:** R-089
**Applies To:** all

## Problem

HTTP 400 Bad Request + `[QueryCache] Fetch falhou` em toda abertura da view afetada. UI mostra "Erro ao carregar dados".

## Prevention

Manter JSDoc do service sincronizado com o schema real da tabela. Verificar schema antes de adicionar colunas ao select.
