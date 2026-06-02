# Artifact Coverage Analysis: Liquid Medications Database & Backend Foundation

**Feature Directory**: `plans/specs/022-liquid-medications-db-backend`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: PASS (dev-ready após revisão)

---

## Legacy Source Coverage

| Legacy Section | Migrado Para | Notas |
|----------------|--------------|-------|
| 1. Problema/Descoberta | `spec.md` (Context) | Líquido derivado da unidade de concentração (`/ml`), sem booleano. |
| 2. Fórmulas (gotas→ml) | `plan.md` (RPC) | `ROUND(p_quantity / drops_per_ml, 2)`. |
| 3. Modelagem de Dados | `plan.md` (Migrations) | Schema real: `quantity`/`original_quantity` numeric; sem colunas novas em `stock`. |
| 6. Retrocompat/Migração | `spec.md` US2 + `plan.md` passo 3 | **Migração de dados explícita** `ml`/`gotas` → `mg/ml` + `intake_unit`. |

---

## Requirement Coverage

| Requisito | Tem Task? | Task IDs | Notas |
|-----------|-----------|----------|-------|
| FR-001 (enum `mg/ml`/`ui/ml`) | Sim | T003 | Recria CHECK se existir. |
| FR-002 (`drops_per_ml`) | Sim | T004 | |
| FR-003 (`intake_unit`) | Sim | T004 | |
| FR-004 (CHECK saldo ≥ 0) | Sim | T004 | |
| FR-005 (migração de dados) | Sim | T005, T007 | Idempotente; valida contagem 0. |
| FR-006 (RPC líquida) | Sim | T006 | Mantém assinatura; hardening SECURITY DEFINER. |

---

## Contract / ADR Coverage

- **ADR-052**: líquidos antes de diabetes; exercita a "parede de unidade" (dose+estoque+display) sem biomarcadores.
- **ADR-048/050**: estoque integra com `dose_instances`/`medicine_logs` (âncora de log inalterada).
- **CON (a registrar no C5)**: a RPC `consume_stock_fifo` muda a **semântica** de `p_quantity` (passa a ser a unidade de tomada `intake_unit` para líquidos, convertida internamente para ml). Catalogar como CON-NNN — **mudança aditiva/compatível** (sólidos inalterados), sem ADR de breaking change.

---

## Constitution Alignment

- `smart-data-design`: `numeric` + `ROUND(.,2)`; sem coluna redundante. ✅
- `backwards-compatibility`: migração idempotente; sólidos e queries de soma intactos. ✅
- `single-source-of-truth`: unidade define líquido. ✅

---

## Gaps (resolvidos nesta revisão)

| ID | Severidade | Resumo | Ação |
|----|-----------|--------|------|
| G-022-1 | CRITICAL (resolvido) | Detecção `LIKE '%/ml'` não casava — enum não tinha `/ml`. | FR-001 estende o enum + FR-005 migra `ml`/`gotas`. |
| G-022-2 | HIGH (resolvido) | Draft pedia `is_liquid` boolean; specs removeram sem migrar dados. | Decisão PO: derivar da unidade; migração de dados explícita (US2). |
| G-022-3 | MEDIUM (resolvido) | Texto afirmava `numeric(10,2)`; colunas são `numeric` puro. | `plan.md` corrige: precisão por `ROUND`, não pela coluna. |
| G-022-4 | LOW (resolvido) | `CON-025` fantasma referenciado. | Trocado por "CON a registrar no C5". |

---

## Gate Decision

**Status**: **PASS — Dev Ready.** Fundação estrutural completa, retrocompatível e com **migração de dados explícita** dos líquidos legados. Bloqueador crítico (enum `/ml`) resolvido. Pronta para `/devflow coding`.
