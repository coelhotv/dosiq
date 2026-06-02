# Tasks: Patient Cared Mode & Upstream Signals (Caregiver Mode — Phase 6)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-6-patient-cared-mode`
**Epic**: [Modo Cuidador](../EPIC.md) · **Input**: [spec.md](./spec.md), [plan.md](./plan.md)
**Status**: Dev Ready

---

## Phase 0 — Reality Gates (C1)
- [ ] **T001** [C1] **GATE**: ler estrutura de `notification_log` → decidir reuso bidirecional vs tabela `patient_signals` (Open Question).
- [ ] **T002** [C1] **GATE**: confirmar como detectar "modo cuidado" via `getContexts()` (phase-0) — `caregiver_links manager` para o `user_id` do device.
- [ ] **T003** [C1] Confirmar reuso do transporte de notificação da phase-4 (direção inversa).

## Phase 1 — UI modo cuidado (mobile)
- [ ] **T004** [US1] Home cuidado simplificada AAA: agenda do dia + "Tomei" grande; **ocultar** edição de medicamentos/posologia. Contraste ≥7:1, toque ≥60px.
- [ ] **T005** [US1] Registro de dose + retroativo simples (reusa `registerDose`).

## Phase 2 — Sinais upstream
- [ ] **T006** [US2] `PatientSignalSheet.jsx` — sinais "estoque acabando" / "perdi comprimidos" / "não consegui tomar" (≤2 toques, desfazer fácil).
- [ ] **T007** [US2] `sendPatientSignal(type, payload)` no core → grava + dispara ao cuidador (transporte phase-4).
- [ ] **T008** [US3] Fila offline (AsyncStorage) + sync ao reconectar + feedback à Maria.

## Phase 3 — Validation (C4)
- [ ] **T009** [C4] Testes: modo cuidado oculta edição; sinal chega ao cuidador online; enfileira offline e entrega ao reconectar; canal `none` registra sem push.
- [ ] **T010** [C4] `rtk lint` + `rtk npm run validate:agent`.
- [ ] **T011** [C4] Smoke PO AAA: confirmar dose + sinal em ≤2 toques; teste com usuário 60+ se possível.

## Phase 4 — Record (C5)
- [ ] **T012** [C5] SQP R-221 (minor mobile+core), bump + CHANGELOG PT + store-note.
- [ ] **T013** [C5] events/journal/state; PR; Gemini + aprovação humana (R-060).

## Traceability
FR-001→T004 · FR-002/003/004→T006/T007 · FR-005→T008 · FR-006→T005.
