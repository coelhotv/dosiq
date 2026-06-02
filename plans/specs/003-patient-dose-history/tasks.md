# Tasks: Histórico de Doses do Paciente (Mobile)

**Feature Directory**: `plans/specs/003-patient-dose-history`
**Input**: `spec.md`, `plan.md` · **Status**: Dev Ready · **Tier**: 1

---

## Phase 0 — Reality Gates (C1)
- [ ] T001 [C1] Build nativa (`rtk expo run:*`, não Expo Go).
- [ ] T002 [C1] **GATE**: confirmar métodos de `createDoseInstanceRepository` (`@dosiq/core`); se faltar leitura por range de datas, estender o repo (não inventar `doseInstanceRepository.js`).
- [ ] T003 [C1] **GATE**: ler `registerDose` (`doseService.js:136`) + `logSchema` → payload mínimo. Verificar se existe `undoDose`/delete de log ancorado; senão, planejar criar reusando o rollback do service.

## Phase 1 — UI
- [ ] T004 [US1] `HistoryScreen.jsx` [NEW] (`features/history`) — agrega KPIs + WeekCalendar + lista.
- [ ] T005 [US1] `WeekCalendar.jsx` — semanal navegável (setas+swipe), coluna clicável ≥60px (PO-4), dots 3 estados, pill teal (`mock-historico-doses.png`).
- [ ] T006 [US1] `DoseHistoryKpis.jsx` — 3 cards (Adesão 30d · Sequência · Doses mês).
- [ ] T006b [US1] `DoseHistoryList.jsx` — virtualizada, chips por status; empty "Nada por aqui" (PO-3, `mock-historico-semdoses.png`); reusa derivações de `_useTodayDerived.js`.
- [ ] T006c [US1] Entry point "Histórico de Doses" no Perfil hub › Ferramentas (`mock-perfil-entrypoints`).

## Phase 2 — Mutação
- [ ] T007 [US2] `DoseActionSheet.jsx` — retroativo via `registerDose({...,taken_at},{instanceId})`.
- [ ] T008 [US2] `undoDose(instanceId)` no `doseService` (delete log ancorado + revert status) — reusa rollback existente. Skip → só revert status.
- [ ] T009 [US2] Invalidar `@dosiq/dose-instances-snapshot` + `@dosiq/adherence-snapshot` após mutação.

## Phase 3 — Validation (C4)
- [ ] T010 [P] [C4] Testes: retroativo cria log+consumo+ancora; desfazer remove log+reverte; sem `taken_at` em `dose_instances`.
- [ ] T011 [C4] `rtk lint` + `rtk npm run validate:agent`.
- [ ] T012 [C4] Smoke PO: ≥55fps; sync <200ms pós-mutação.

## Phase 4 — Record (C5)
- [ ] T013 [C5] SQP R-221 (minor mobile+core), bump + CHANGELOG + store-note.
- [ ] T014 [C5] events/journal/state; PR; Gemini + aprovação humana (R-060).

## Traceability
FR-001→T005 · FR-002→T002/T006 · FR-003→T007/T008 · FR-004→T009.
