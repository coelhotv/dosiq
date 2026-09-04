---
title: Usar componente Button com className custom causa conflito de estilos no mobile
summary: Usar componente Button com className custom causa conflito de estilos no mobile
layer: cold
status: archived
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - className
  keywords:
    - usar
    - componente
    - button
    - classname
    - custom
    - causa
    - conflito
    - estilos
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-W25
incident_count: 1
last_referenced: "2026-03-31"
last_triggered: None
legacy_pack: design-ui
related_rule: R-119
tags:
  - ui
  - react
trigger_count: 0
---

# AP-W25 — Usar componente Button com className custom causa conflito de estilos no mobile

**Category:** Ui
**Status:** active
**Related Rule:** R-119
**Applies To:** all

## Problem



## Prevention




**O que é:** O componente `Button` renderiza `btn btn-primary btn-md {className}`. As classes `btn-primary` e `btn-md` do Button.css têm suas próprias regras (incluindo media queries mobile) que ganham em especificidade ou ordem de cascata sobre o `className` custom passado.

**Problema:** No Auth redesign (W13), o botão "Entrar" ficava com cor diferente no mobile — o `btn-primary` sobrescrevia o gradiente verde do `.auth-submit-btn` no breakpoint `@media (max-width: 480px)`.

**Prevenção:** Quando os estilos do botão são 100% custom (gradiente próprio, border-radius próprio, etc.), usar `<button>` nativo com o className diretamente — não passar o componente `Button`.

**Regra:** `Button` = variantes do design system (primary, secondary, ghost). Estilo 100% próprio = `<button>` nativo.

*Registrado: 2026-03-31*

---
