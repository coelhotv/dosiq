---
id: AP-W25
title: Usar componente Button com className custom causa conflito de estilos no mobile
summary: Usar componente Button com className custom causa conflito de estilos no mobile
applies_to:
  - all
tags:
  - ui
  - react
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-119
layer: cold
bootstrap_default: False
pack: design-ui
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
