# Requirements Checklist: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Source**: spec revisada (dev-ready)

---

## Completeness

- [ ] CHK001 O enum `DOSAGE_UNITS` ganha `mg/ml`/`ui/ml` E o `medicineSchema` exige `drops_per_ml` para líquidos (concentração nullable)? [Completeness]
- [ ] CHK002 O cap-100 foi elevado nos 4 arquivos corretos (`logSchema`, `adherencePatternSchema`, `costAnalysisSchema`, `reminderOptimizerSchema`) — e NÃO em `protocolSchema` (já 1000)? [Completeness]
- [ ] CHK003 O desmembramento usa `create_purchase_with_stock` (N×), sem `stock.insert` direto? [Completeness]

## Clarity

- [ ] CHK004 `formatDose` reusa `formatNumberPtBR` (vírgula + milhares) e o singular `1 gota`? [Clarity]
- [ ] CHK005 A compensação de centavos fecha o total exato (`Σ unit_price*V ≈ total`)? [Clarity]
- [ ] CHK006 A cross-validação líquido⇒`intake_unit` tem abordagem definida (campo de contexto ou no service)? [Clarity]

## Traceability

- [ ] CHK007 Cada FR (001–006) mapeia ≥1 task? [Traceability]
- [ ] CHK008 A edição apontou a DEFINIÇÃO no core (web faz `export *`), não o caller (AP-199)? [Traceability]

## Constitution Alignment

- [ ] CHK009 `formatDose` é função pura que estende `doseUnit.js` (dry-principles), sem helper paralelo? [Consistency]
- [ ] CHK010 A revisão de R-022 (cap-100→1000) está documentada nas regras DEVFLOW no C5? [Consistency]
- [ ] CHK011 Respeita "Never Self-Merge" (R-060)? [Consistency]
