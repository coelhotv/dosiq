---
id: AP-B01
title: Adicionar `<link rel="modulepreload" href="/src/main.jsx" />` manual em `index.html` no Vite 7
summary: Vite 7 base64-encoda o conteúdo raw do JSX e emite `data:text/jsx;base64,...` no `dist/index.html`. 
applies_to:
  - all
tags:
  - safety
  - build
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-117
layer: cold
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-B01 — Adicionar `<link rel="modulepreload" href="/src/main.jsx" />` manual em `index.html` no Vite 7

**Category:** Build
**Status:** active
**Related Rule:** R-117
**Applies To:** all

## Problem

Vite 7 base64-encoda o conteúdo raw do JSX e emite `data:text/jsx;base64,...` no `dist/index.html`. Browser rejeita com MIME type error. O Vite já gera modulepreload hints corretos para todos os chunks automaticamente.

## Prevention

Nunca adicionar hints manuais de modulepreload apontando para arquivos fonte. Deixar o Vite gerar os hints automaticamente.
