---
id: AP-D07
title: Core-Mobile Adherence Parity Gap
summary: Assumir que flags calculadas no frontend Web (via props/hooks) estarão disponíveis no Mobile sem injeção explícita no Core.
applies_to:
  - logic
  - core
  - mobile
tags:
  - data
  - regression
  - adherence
incident_count: 1
last_referenced: 2026-04-24
status: active
---

# AP-D07 — Core-Mobile Adherence Parity Gap

## O Sintoma
O Dashboard Nativo exibe contadores zerados (ex: `0/4 tomadas`) mesmo quando existem logs de adesão no banco de dados e os medicamentos estão visíveis.

## A Causa
A função `evaluateDoseTimelineState` no `@dosiq/core` dependia de flags como `isRegistered` sendo passadas externamente ou injetadas por hooks de alto nível que só existem no React da Web. No Mobile, a lógica de contagem é mais "lean", e se o objeto da dose não carrega explicitamente o estado de registro, o contador falha.

## A Solução
Sempre injetar a flag `isRegistered` (calculando baseada na existência da `dose_id` no log) diretamente na camada de serviço ou no utilitário de core, garantindo que o objeto de dados seja "self-contained" para qualquer plataforma.

## Exemplo Real (Fix v0.1.7)
```javascript
// packages/core/src/utils/adherenceLogic.js
// ANTES: dependia de injeção manual na View
// DEPOIS: 
if (logResult) {
  isRegistered = true;
  evaluation = 'TOMADA';
}
```
