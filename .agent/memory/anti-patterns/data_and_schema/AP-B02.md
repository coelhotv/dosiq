---
title: "Selecionar coluna inexistente em query Supabase (ex: `status` em `medicine_logs`)"
summary: >-
  HTTP 400 Bad Request + `[QueryCache] Fetch falhou` em toda abertura da view afetada. UI mostra
  "Erro
layer: cold
status: archived
applies_to:
  paths:
    - packages/**
    - "**/schemas/**"
  diff_triggers:
    - medicine_logs
  keywords:
    - selecionar
    - coluna
    - inexistente
    - query
    - supabase
    - status
    - medicine_logs
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-B02
incident_count: 0
last_triggered: None
legacy_pack: schema-data
related_rule: R-089
tags:
  - perf
  - database
  - build
  - api
trigger_count: 0
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
