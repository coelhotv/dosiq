---
title: Exibir dados de Carlos (bar-pct, quantidade, histórico global) no modo Dona Maria
summary: Exibir dados de Carlos (bar-pct, quantidade, histórico global) no modo Dona Maria
layer: cold
status: archived
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - AdherenceBar7d
    - AdherenceLabel
    - EntradaHistorico
  keywords:
    - exibir
    - dados
    - carlos
    - bar
    - pct
    - quantidade
    - histórico
    - global
legacy_tags:
  - all
bootstrap_default: false
expiry_date: "2027-04-08"
id: AP-D06
incident_count: 0
last_triggered: None
legacy_pack: design-ui
related_rule: R-153
tags:
  - design
trigger_count: 0
---

# AP-D06 — Exibir dados de Carlos (bar-pct, quantidade, histórico global) no modo Dona Maria

**Category:** Design
**Status:** active
**Related Rule:** R-153
**Applies To:** all

## Problem



## Prevention




**O que é:** Copiar elementos do modo `complex` para o modo `simple` sem questionar se cada elemento informa uma ação.

**Elementos que Carlos vê mas Dona Maria NÃO deve ver:**
- `bar-pct %` (a barra visual já é suficiente)
- Quantidade de unidades em estoque (não informa decisão imediata)
- Seção de `EntradaHistorico` global (substituída por "última compra: DD/MM · R$ X,XX" per-card)
- `AdherenceBar7d` com % (substituída por `AdherenceLabel` com texto humano)
- CTA para status `seguro`/`alto` em StockCard (sem ação necessária = sem botão)

**Teste mental:** "Esse dado leva Dona Maria a tomar uma ação agora?" Se não → remova ou traduza.

**Relacionado:** R-153

---

*Last updated: 2026-03-26*
*Anti-patterns: AP-W01 through AP-W23, AP-S01, AP-D01 through AP-D06 (Wave 7.5/8 design dichotomy additions)*


---
