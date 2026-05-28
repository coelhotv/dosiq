---
id: AP-D04
title: Criar sistema de badge de estoque novo em vez de reutilizar StockPill
summary: Criar sistema de badge de estoque novo em vez de reutilizar StockPill
applies_to:
  - all
tags:
  - design
trigger_count: 0
last_triggered: None
expiry_date: 2027-04-08
status: archived
related_rule: R-154
layer: cold
bootstrap_default: False
pack: design-ui
---

# AP-D04 — Criar sistema de badge de estoque novo em vez de reutilizar StockPill

**Category:** Design
**Status:** active
**Related Rule:** R-154
**Applies To:** all

## Problem



## Prevention




**O que é:** Criar classes CSS de badge (e.g., `.stock-badge--urgente`) em um componente novo quando `StockPill` já existe.

**Consequência:** Dois sistemas visuais para o mesmo conceito (status de estoque) em telas diferentes. Usuário vê linguagem visual inconsistente entre Treatments e Stock. Dívida técnica duplicada.

**Prevenção:**
```jsx
// ❌ ERRADO — badge próprio
<span className={`stock-card-r__badge stock-card-r__badge--${stockStatus}`}>
  {STATUS_LABELS[stockStatus]}
</span>

// ✅ CORRETO — reutilizar StockPill de W7.6
import StockPill from '@protocols/components/redesign/StockPill'
<StockPill status={stockStatus} daysRemaining={Math.floor(item.daysRemaining)} />
```

**Relacionado:** R-154

---
