# Artifact Coverage Analysis: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: PASS (dev-ready após revisão)

---

## Legacy Source Coverage

| Legacy Section | Migrado Para | Notas |
|----------------|--------------|-------|
| 4. UX/UI | `spec.md` US1–3 + `plan.md` §1–4 | Forms dinâmicos + wizard + banner com conversão. |
| 5. Bot Telegram | `spec.md` US4 + `plan.md` §5 | `formatDose` + débito via `consume_stock_fifo`. |

---

## Requirement Coverage

| Requisito | Tem Task? | Task IDs | Notas |
|-----------|-----------|----------|-------|
| FR-001 (dropdown + wizard) | Sim | T003, T004, T005 | Expõe `mg/ml`/`ui/ml`; oculta `ml`/`gotas`. |
| FR-002 (`intake_unit` select) | Sim | T006 | web + mobile. |
| FR-003 (StockForm hints) | Sim | T007 | mobile a confirmar (T002). |
| FR-004 (banner conversão) | Sim | T008 | converte gotas→ml. |
| FR-005 (Telegram) | Sim | T009, T010 | `formatDose` + RPC. |

---

## Contract / ADR Coverage

- **ADR-046**: `formatDose` centraliza renderização (consumido aqui, definido na 023).
- **CON-024 (doseZones)**: não alterado — banner lê `dose_instances`/`protocol`, não muda o contrato.
- **RPC `consume_stock_fifo`**: consumida pelo bot sem mudança de assinatura (conversão interna).

---

## Constitution Alignment

- `visual-hierarchy` / a11y (R-137/138): badges/hints discretos, copy idoso-friendly. ✅
- `mobile-performance`: sem libs novas. ✅
- `backwards-compatibility`: sólidos mantêm a UI atual; `ml`/`gotas` saem só da **concentração**, não quebram protocolos migrados. ✅

---

## Gaps (resolvidos nesta revisão)

| ID | Severidade | Resumo | Ação |
|----|-----------|--------|------|
| G-024-1 | HIGH (resolvido) | Banner comparava `stock.quantity` (ml) com `expected_dose` (gotas) — erro de unidade. | FR-004/§4: converte para ml antes (`nextDoseMl`). |
| G-024-2 | HIGH (resolvido) | Dropdown listava `mg/ml` inexistente e mantinha `ml`/`gotas` como concentração. | FR-001: enum estendido (022/023) + remove `ml`/`gotas` da concentração; expõe no wizard. |
| G-024-3 | MEDIUM (resolvido) | Paths mobile `.tsx`; sem `StockForm` mobile. | Paths reais `.jsx`; estoque mobile marcado p/ verificar em C1. |
| G-024-4 | MEDIUM (resolvido) | `CON-025` fantasma e "100% perfeita" sem evidência. | Removido; contratos reais referenciados. |
| G-024-5 | LOW (resolvido) | Wizard não mencionado (pedido do PO). | FR-001/T005 cobrem o passo de medicamento do onboarding. |

---

## Gate Decision

**Status**: **PASS — Dev Ready.** Erro de unidade do banner e premissas de dropdown corrigidos; paths reais; wizard incluído. Pronta para `/devflow coding` (após 022 e 023). Itens marcados para confirmação em C1 (estoque mobile, reuso do `MedicineForm` no wizard) são verificações, não bloqueios.
