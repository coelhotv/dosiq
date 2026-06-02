# Tasks: Dashboard de Aderência Expandida (Mobile)

**Feature Directory**: `plans/specs/004-expanded-adherence-dashboard`
**Input**: `spec.md`, `plan.md` · **Status**: Dev Ready · **Tier**: 1

---

## Phase 0 — Reality Gates (C1)
- [ ] T001 [C1] Build nativa (`rtk expo run:*`).
- [ ] T002 [C1] **GATE**: ler `packages/core/src/utils/adherenceLogic.js` — mapear funções existentes (taxa por período, série, streak). **Não criar `adherenceCalculator.js`.** Identificar se falta agregação bloco×dia-da-semana (heatmap).
- [ ] T003 [C1] **GATE**: ler `dashboardService.js` mobile — onde plugar as agregações de período (estender, não duplicar).

## Phase 1 — Cálculo (core, só se faltar)
- [ ] T004 [US2] Se faltar, adicionar função pura `aggregateByBlockAndWeekday(instances, tz)` em `adherenceLogic.js` + teste de paridade.

## Phase 2 — UI (features/dashboard)
- [ ] T005 [US1] `RingGauge.jsx`.
- [ ] T006 [US1] `AdherenceSparkline.jsx` (leve).
- [ ] T007 [US2] `TemporalHeatmap.jsx`.
- [ ] T008 [US1] `AdherenceDashboardScreen.jsx` — filtros 7/30/90 + cache SWR; cold-start vazio guiado.
- [ ] T009 [US1] `dashboardService.js` [MOD] — agregações de período via `adherenceLogic`; invalidação `@dosiq/adherence-snapshot`.

## Phase 3 — Validation (C4)
- [ ] T010 [P] [C4] Testes: paridade de cálculo (core), cold-start sem NaN, zero network em cache.
- [ ] T011 [C4] `rtk lint` + `rtk npm run validate:agent`.
- [ ] T012 [C4] Smoke PO: render <150ms em cache; ≥55fps.

## Phase 4 — Record (C5)
- [ ] T013 [C5] SQP R-221 (minor), bump + CHANGELOG.
- [ ] T014 [C5] events/journal/state; PR; Gemini + aprovação humana.

## Traceability
FR-001→T008 · FR-002→T005 · FR-003→T006 · FR-004→T007/T004 · FR-005→T009/T002.
