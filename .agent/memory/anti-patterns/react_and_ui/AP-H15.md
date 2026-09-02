---
title: Use useCallback with state in deps when effect depends on the callback
summary: >-
  useCallback com state no deps array + useEffect([callback]) cria loop infinito: state muda → novo
  callback → effect re-executa → novo fetch → state muda → ... Usar useRef para valores que precisam
  de ser lidos no callback sem causar re-renders.
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  keywords:
    - use
    - usecallback
    - with
    - state
    - deps
    - when
    - effect
    - depends
legacy_tags:
  - apps/mobile/src/features/dashboard/hooks/useTodayData.js
bootstrap_default: false
expiry_date: "2027-04-14"
id: AP-H15
last_triggered: "2026-04-14"
legacy_pack: react-hooks
related_rule: None
tags:
  - mobile
  - react
  - hooks
  - useCallback
  - useEffect
  - loop
trigger_count: 1
---

useCallback com state no deps array + useEffect([callback]) cria loop infinito: state muda → novo callback → effect re-executa → novo fetch → state muda → ... Usar useRef para valores que precisam de ser lidos no callback sem causar re-renders.