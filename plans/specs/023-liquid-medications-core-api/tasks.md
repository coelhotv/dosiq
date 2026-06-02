# Tasks: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`
**Input**: `spec.md`, `plan.md`
**Status**: Dev Ready

---

## Phase 1: Setup / Preflight

- [ ] T001 [C1] Confirmar que a spec 022 (enum + colunas + migração) está mergeada/aplicada (pré-requisito). Rodar testes críticos do core antes de mexer.
- [ ] T002 [C1] Confirmar que `apps/web/src/schemas/{medicineSchema,protocolSchema}.js` fazem `export *` do core (verificado) → editar SÓ a definição em `packages/core/src/schemas/`.

---

## Phase 2: Implementation (Zod, Services & Helper)

- [ ] T003 [US1] `medicineSchema.js`: `DOSAGE_UNITS` += `'mg/ml'`,`'ui/ml'`; `drops_per_ml`/`dosage_per_pill` nullable; superRefine exige `drops_per_ml` quando unidade termina em `/ml`.
- [ ] T004 [US1] `protocolSchema.js`: adicionar `intake_unit` (`enum ['gotas','ml','UI']` nullable) + cross-validação líquido⇒`intake_unit` (via `_medicineIsLiquid` ou no service).
- [ ] T005 [US1] Elevar cap `.max(100)`→`.max(1000)` em `logSchema.js` (`quantity_taken`), `adherencePatternSchema.js`, `costAnalysisSchema.js`, `reminderOptimizerSchema.js`; comentar revisão de R-022.
- [ ] T006 [US3] Estender `packages/core/src/utils/doseUnit.js` com `formatDose(value, unit)` (reusa `formatNumberPtBR`).
- [ ] T007 [US2] `apps/web/src/features/stock/services/stockService.js`: desmembrar `N frascos × V ml × preço total` em N× `create_purchase_with_stock` + compensação de centavos no último.
- [ ] T008 [US2] `apps/mobile/src/features/stock/services/stockService.js`: sincronizar o mesmo desmembramento (JS).

---

## Phase 3: Validation (Quality Gates)

- [ ] T009 [P] [C4] Testes Zod: `medicineSchema` (líquido sem `drops_per_ml` rejeita; com aceita; sólido inalterado) e `protocolSchema` (`intake_unit` decimal; cross-validação).
- [ ] T010 [P] [C4] Teste: `logSchema` aceita `quantity_taken = 100`/`1000` (regressão do cap revisado) e rejeita `> 1000`.
- [ ] T011 [P] [C4] Testes `formatDose`: `15 gotas`, `1 gota`, `2,5 ml`, `UI`, fallback sólido.
- [ ] T012 [C4] Testes do desmembramento `stockService`: 3 frascos R$30 → 3× RPC `p_quantity=100`,`p_unit_price=0.10`; caso R$10 com compensação de centavos no último (total reconstruído exato). Mock `supabase.rpc`.
- [ ] T013 [C4] Rodar `rtk npm run validate:agent` (linter zero + suíte crítica).

---

## Phase 4: DEVFLOW Record

- [ ] T014 [C5] SQP (R-221): Shared/Core + Web/Mobile; impacto Minor (novas unidades/validações, sem quebra); CHANGELOG [Unreleased]. Registrar revisão de R-022 (cap-100→1000) nas regras.
- [ ] T015 [C5] Abrir PR; aguardar Gemini + aprovação humana (R-060).

## Dependencies
T003–T006 (core) independentes entre si. T007/T008 dependem de 022 aplicada. Validação após implementação.

## Parallel Opportunities
T009–T011 `[P]`. T003/T004/T005/T006 podem ser paralelos (arquivos distintos no core).
