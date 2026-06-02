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
- [ ] T005 [US1] `AdherenceRingHero.jsx` — anel 148px + meta 90% + delta pp (`mock-adesao-30d.png`).
- [ ] T006 [US1] `AdherenceLineChart.jsx` ~30 pts (verde-escuro >100%, leve) + `AdherenceHeatmap.jsx` (período×dia).
- [ ] T007 [US1] `AdherenceKpis.jsx` (Doses tomadas N/total · Pontualidade %) + insights acionáveis.
- [ ] T008 [US1] `AdherenceDashboardScreen.jsx` — segmented 7/30/90 (def 30d) + cache SWR; cold-start guiado.
- [ ] T008b [US1] **Entry point (PO-1):** anel do Dashboard "Hoje" ganha affordance visual (sombra+chevron, sem texto) → navega à tela (`mock-dashboard-entrypoint-adesao.png`).
- [ ] T009 [US1] `dashboardService.js` [MOD] — agregações de período via `adherenceLogic`; invalida `@dosiq/adherence-snapshot`.

## Phase 3 — Validation (C4)
- [ ] T010 [P] [C4] Testes: paridade de cálculo (core), cold-start sem NaN, zero network em cache.
- [ ] T011 [C4] `rtk lint` + `rtk npm run validate:agent`.
- [ ] T012 [C4] Smoke PO: render <150ms em cache; ≥55fps.
- [ ] T012b [C4] **Gate G2/G3 (paridade web):** decidir factory vs utils; se factory, web adota com **regressão 0%** (`validate:agent` web green). Documentar.

## Phase 4 — Record (C5)
- [ ] T013 [C5] SQP R-221 (minor), bump + CHANGELOG.
- [ ] T014 [C5] events/journal/state; PR; Gemini + aprovação humana.

## Traceability
FR-001→T008b · FR-002→T008 · FR-003→T005 · FR-004→T007 · FR-005→T006 · FR-006→T006 · FR-007→T007 · FR-008→T009/T002 · FR-009→T012b.
