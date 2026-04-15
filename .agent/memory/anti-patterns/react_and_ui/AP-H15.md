---
id: AP-H15
title: Use useCallback with state in deps when effect depends on the callback
summary: useCallback com state no deps array + useEffect([callback]) cria loop infinito: state muda → novo callback → effect re-executa → novo fetch → state muda → ... Usar useRef para valores que precisam de ser lidos no callback sem causar re-renders.
applies_to:
  - apps/mobile/src/features/dashboard/hooks/useTodayData.js
tags:
  - mobile
  - react
  - hooks
  - useCallback
  - useEffect
  - loop
trigger_count: 1
last_triggered: 2026-04-14
expiry_date: 2027-04-14
status: active
related_rule: None
layer: warm
bootstrap_default: False
pack: react-hooks
---

useCallback com state no deps array + useEffect([callback]) cria loop infinito: state muda → novo callback → effect re-executa → novo fetch → state muda → ... Usar useRef para valores que precisam de ser lidos no callback sem causar re-renders.