---
title: useState(() => derivedHook()) assumindo que continua reativo
summary: 'Inicializador de useState roda UMA vez: se o valor derivado mudar depois da montagem, o estado fica velho e a tela mostra o cálculo da primeira renderização para sempre.'
layer: warm
status: active
applies_to:
  paths:
    - apps/web/src/**/*.tsx
    - apps/web/src/**/hooks/**
    - apps/mobile/src/**/*.tsx
  diff_triggers:
    - useState(()
    - useState(() =>
  keywords:
    - useState
    - derivado
    - stale
last_updated: '2026-08-31'
origin: 060 Lote 1 (piloto) — semente do measurement.md 034-D
legacy_tags:
  - all
---

# AP-W15 — Initialize state with `useState(() => derivedHook())` assuming it will stay reactive

**Category:** Ui
**Status:** active
**Related Rule:** R-107
**Applies To:** all

## Problem

State is stale if derived value changes after mount (e.g., `defaultViewMode` after complexity change)

## Prevention

Add `useEffect(() => { if (!savedPref) setState(derived) }, [derived])`
