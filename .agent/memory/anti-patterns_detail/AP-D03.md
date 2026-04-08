# AP-D03 — Using `COUNT(*)` to count expected dose opportunities in heatmap when `COUNT(DISTINCT protocol_id)` is semantically needed

**Category:** Design
**Status:** active
**Related Rule:** R-121
**Applies To:** all

## Problem

After CROSS JOIN LATERAL jsonb_array_elements_text (expands doses), `COUNT(*)` correctly counts all dose opportunities. But switching to `COUNT(DISTINCT p.id)` "optimizes" and breaks count—back to counting protocols, not doses

## Prevention

Document reason for aggregation method in SQL comment. If you ever switch aggregation, re-validate output against known test data (e.g., 10 protocols, 12 doses/day)


**O que é:** Verificar `mode === 'moderate'` em qualquer componente ou lógica de view.

**Consequência:** O modo `moderate` foi eliminado da filosofia de design. `isComplex = mode !== 'simple'` é o único predicado válido. Carlos com 4 meds e Carlos com 8 meds são a mesma persona — o CSS grid resolve a densidade por breakpoint.

**Prevenção:**
```javascript
// ❌ PROIBIDO
const isComplex = mode === 'complex' || mode === 'moderate'
const gridClass = mode === 'complex' ? 'grid-3' : mode === 'moderate' ? 'grid-2' : ''

// ✅ CORRETO
const isComplex = mode !== 'simple'
// CSS decide colunas: @media (min-width: 768px) { grid-template-columns: repeat(2,1fr) }
// @media (min-width: 1280px) { grid-template-columns: repeat(3,1fr) }
```

**Relacionado:** R-152

---
