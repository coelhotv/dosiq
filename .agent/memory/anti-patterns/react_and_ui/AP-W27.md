---
title: Hardcoded Typography e FontWeights
summary: Typography e FontWeights fixos (hardcoded) em vez de usar tokens compartilhados.
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - StyleSheet
    - tokens.js
    - typography.fontFamily.bold
    - typography.fontWeight.bold
  keywords:
    - hardcoded
    - typography
    - fontweights
incident_count: 1
last_referenced: "2026-04-22"
---

# [AP-W27] Hardcoded Typography e FontWeights

## Problema
Uso de strings puras como `'800'`, `'bold'` ou `'Inter-Bold'` diretamente nos componentes or `StyleSheet`.

## Sintoma
Dificuldade em manter consistência visual ao trocar a fonte do projeto ou ajustar o peso visual global. Perda da paridade visual entre telas quando um desenvolvedor usa `800` e outro `900` para o mesmo título.

## Como Evitar
- Sempre utilize os tokens de tipografia em `shared/styles/tokens.js`.
- Use `typography.fontWeight.bold` e `typography.fontFamily.bold` (ou as variáveis disponíveis).

## Caso Real
Cabeçalhos das abas mobile apresentavam diferentes pesos visuais (`700` vs `800`) antes da padronização da v0.1.3 em `tokens.js`.
