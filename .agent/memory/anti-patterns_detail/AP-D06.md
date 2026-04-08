# AP-D06 — Exibir dados de Carlos (bar-pct, quantidade, histórico global) no modo Dona Maria

**Category:** Design
**Status:** active
**Related Rule:** None
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
