# Tasks: Alert Engine (Caregiver Mode — Phase 4)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-4-alert-engine`
**Epic**: [Modo Cuidador](../EPIC.md) · **Input**: [spec.md](./spec.md), [plan.md](./plan.md)
**Status**: Dev Ready

---

## Phase 0 — Reality Gates (C1)
- [ ] **T001** [C1] **GATE R-090**: confirmar que o cron existente (`server/bot/` scheduler) pode hospedar a avaliação dos eventos — **não criar função serverless nova**.
- [ ] **T002** [C1] **GATE**: ler `_adherenceHelpers.js` + estrutura de `notification_log` + `dose_instances.notified_at` → decidir onde persistir a flag de idempotência (não inventar tabela).
- [ ] **T003** [C1] **Resolver Open Questions com PO**: enum final de `notification_channel` (`push/telegram/email/none`) + limiar de digest.

## Phase 1 — Core (resolução de alvo/canal)
- [ ] **T004** [US1] `getCaregiversToNotify(patientId, event)` em `createCaregiverRepository.js` — JOIN `caregiver_links` (`patient_id`=`user_id` paciente, `role='manager'`), filtra `notification_channel != 'none'`.

## Phase 2 — Engine de eventos (cron)
- [ ] **T005** [US1] Evento **dose atrasada** (FR-001): após tolerância (30 min, fuso do paciente) sem registro → disparo idempotente.
- [ ] **T006** [US1] Evento **dose perdida** (FR-002) ao `status='missed'`.
- [ ] **T007** [US2] Eventos **estoque crítico** (FR-003) e **receita vencendo** (FR-004) no cron de estoque existente.
- [ ] **T008** [US2] **Digest semanal** (FR-005) domingo 20h fuso do paciente, gated por limiar.
- [ ] **T009** [US1] Evento **vínculo revogado** (FR-006) imediato.
- [ ] **T010** [US1] **Idempotência** (FR-008): checar+marcar flag de envio antes de cada disparo.

## Phase 3 — UI canal
- [ ] **T011** [US1] UI de escolha de `notification_channel` pelo cuidador (Configurações web/mobile).

## Phase 4 — Validation (C4)
- [ ] **T012** [C4] Testes: disparo único por instância (anti-duplicação por tick); canal `none` não dispara; delays no fuso do paciente; vínculo revogado não dispara.
- [ ] **T013** [C4] `rtk lint` + `rtk npm run validate:agent`.
- [ ] **T014** [C4] **Verificar budget R-090**: contagem de funções serverless inalterada.

## Phase 5 — Record (C5)
- [ ] **T015** [C5] SQP R-221 (minor backend+core), bump + CHANGELOG PT.
- [ ] **T016** [C5] events/journal/state; PR; Gemini + aprovação humana (R-060).

## Traceability
FR-001→T005 · FR-002→T006 · FR-003/004→T007 · FR-005→T008 · FR-006→T009 · FR-007→T004/T011 · FR-008→T010.
