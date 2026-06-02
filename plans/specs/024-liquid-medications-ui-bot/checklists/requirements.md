# Requirements Checklist: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Source**: spec revisada (dev-ready)

---

## Completeness

- [ ] CHK001 Os dropdowns (form **e wizard**) expõem `mg/ml`/`ui/ml` e removem `ml`/`gotas` da concentração? [Completeness]
- [ ] CHK002 O select `intake_unit` aparece só para líquidos (web e mobile)? [Completeness]
- [ ] CHK003 O `StockForm` capta frascos/ml/preço total e o caminho mobile foi confirmado em C1? [Completeness]

## Clarity

- [ ] CHK004 O banner converte `expected_dose` para ml (via `drops_per_ml`) antes de comparar com `stock.quantity`? [Clarity]
- [ ] CHK005 A copy do banner e dos hints é clara para idoso (R-137/138)? [Clarity]
- [ ] CHK006 As mensagens do bot usam `formatDose` (PT-BR, singular/plural)? [Clarity]

## Traceability

- [ ] CHK007 Cada FR (001–005) mapeia ≥1 task? [Traceability]
- [ ] CHK008 Os paths de target foram verificados (web reais; mobile `.jsx`/`.js`; estoque mobile marcado p/ C1)? [Traceability]

## Constitution Alignment

- [ ] CHK009 O bot trata estoque zerado best-effort (R-245/246) sem travar? [Consistency]
- [ ] CHK010 Smoke PO antes do PR (R-234) para mudanças de UI+mobile? [Consistency]
- [ ] CHK011 Respeita "Never Self-Merge" (R-060)? [Consistency]
