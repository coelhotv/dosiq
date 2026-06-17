# Tasks 036 — Fix: alarme de soneca obsoleto + full-screen sem saída

**Dir:** `plans/specs/036-fix-alarm-stale-snooze` · **Tier:** 1 · **Status:** Dev Ready
**Input:** spec.md · Mobile-only · sem migração/ADR/contrato.

> Branch sugerida `fix/alarm-stale-snooze`. Planning dobrado no C2 (sem plan.md).

---

## Phase 0 — C1 (pré-código)
- [ ] T001 [C1] Confirmar `cancelAlarm` cobre trigger principal + `:nag:N` + soneca (id reusado) — [alarmService.js:343-350](../../../apps/mobile/src/platform/alarms/alarmService.js). Confirmar import de `alarmService` em `features/dose/services` (camada feature→platform OK).
- [ ] T002 [C1] Confirmar shape do retorno/`instance_id` em `registerDose`/`registerDoseMany` ([doseService.js:321,416](../../../apps/mobile/src/features/dose/services/doseService.js)) e como cada entrada do lote carrega `instanceId`.
- [ ] T003 [C1] Confirmar params disponíveis no `AlarmFullScreen` (route): `doseInstanceId`, `isGrouped`, `doseInstanceIds`; e o repo/leitura pontual de status por id (`createDoseInstanceRepository`).
- [ ] T004 [C1] Confirmar que `buildDoseItemsFromInstances` expõe `intakeUnit`/`unitsPerMl`/`concentrationVolumeMl` no DoseItem ([doseZones.js:139-155](../../../packages/core/src/utils/doseZones.js)) e a assinatura de `formatMedicineConcentration`/`formatDoseItem` ([doseUnit.js:61,346](../../../packages/core/src/utils/doseUnit.js)).

## Phase 1 — Cancel-on-resolve (US1)
- [ ] T010 [US1] `registerDose`: após sucesso `taken` (com `instanceId`), `await alarmService.cancelAlarm(instanceId)` em try/catch best-effort (R-245/246; falha não bloqueia registro/estoque). FR-001/FR-003.
- [ ] T011 [US1] `registerDoseMany`: cancelar `cancelAlarm` de **cada** `instanceId` resolvida no lote (após sucesso). FR-002.
- [ ] T012 [US1] (opcional) emitir `triggerAlarmResync()` 1× ao fim como rede (reconcilia o restante da janela). Avaliar no C1 se redundante com o cancel direto — manter mínimo.

## Phase 1b — Plumbing dos campos clínicos (US3)
- [ ] T013 [US3] `useAlarmScheduler.syncAlarms`: incluir `dosagePerPill, dosageUnit, concentrationVolumeMl, dosagePerIntake, intakeUnit, unitsPerMl` no `data` do `scheduleAlarm` (single) e em cada entrada de `groupedDoses` ([useAlarmScheduler.js:86-126](../../../apps/mobile/src/platform/alarms/useAlarmScheduler.js)). FR-008.
- [ ] T014 [US3] `AlarmSchedulerBridge.openAlarmScreen`: forwardar esses campos nos params da navegação (single) ([AlarmSchedulerBridge.jsx:43-57](../../../apps/mobile/src/platform/alarms/AlarmSchedulerBridge.jsx)). FR-008.

## Phase 2a — Render clínico (US3)
- [ ] T015 [US3] `AlarmFullScreen` ramo **single**: abaixo do nome, linha de **concentração** (`formatMedicineConcentration`) + linha de **quantidade** (`formatDoseItem`). A11y idoso (fonte grande, contraste). FR-006.
- [ ] T016 [US3] `AlarmFullScreen` ramo **agrupado**: trocar o `({dosagePerPill}{dosageUnit}) - {qty} un.` por `formatMedicineConcentration` + `formatDoseItem` por dose. FR-007.

## Phase 2 — Full-screen revalida + auto-dismiss (US2)
- [ ] T020 [US2] `AlarmFullScreen`: no mount/focus, ler `status` da(s) `instanceId`(s) (single + grupo). Se **nenhuma** `pending` → `alarmService.cancelAlarm(...)` + dismiss (`navigation.canGoBack() ? goBack() : navigate(TABS)`). FR-004. Hooks na ordem (R-010): states→effects.
- [ ] T021 [US2] Grupo: dismiss só quando **todas** não-`pending`; se ao menos 1 `pending`, mantém a tela. FR-004.

## Phase 3 — Validation (C4)
- [ ] T030 [P][C4] Unit `doseService`: `registerDose`/`registerDoseMany` chamam `cancelAlarm` por instanceId resolvida; falha do cancel não derruba o registro (mock alarmService).
- [ ] T031 [P][C4] Unit `AlarmFullScreen`: status≠pending no mount → cancelAlarm + dismiss; pending → renderiza normal; grupo parcial → mantém. Render mostra concentração + quantidade (single + grupo); injetável → unidade UI/mL, não "un.".
- [ ] T032 [C4] `rtk lint` 0 erros + jest mobile (doseService + AlarmFullScreen).
- [ ] T033 [C4] Smoke PO (device): SC-001 (soneca→tomada FAB→sem re-disparo), SC-002 (full-screen em dose resolvida→auto-fecha), SC-003 (lote), SC-004 (sem double-count/skip indevido), SC-006 (concentração+quantidade corretas: Selozok mg + Lantus UI).

## Phase 4 — Record (C5)
- [ ] T040 [C5] SQP R-221: mobile patch (bugfix), `APP_VERSION` 0.19.0→0.19.1; CHANGELOG `[Unreleased]` Mobile + store-note ("Correção: o alarme não reabre mais para uma dose já registrada").
- [ ] T041 [C5] AP-235: "alarme local não cancelado ao resolver dose por outra superfície (snooze/nag órfão)". Atualizar README specs (036 delivered + PR#) e header da spec. events + journal + state.json. Avaliar R nova (cancel-on-resolve cross-superfície) p/ a 035 absorver.

## Dependencies
T001-T004 (C1) → resto. T010→T030. T020→T031. T013→T014→T015/T016 (plumbing antes do render).

## Traceability
FR-001→T010 · FR-002→T011 · FR-003→T010/T011 (cancelAlarm) · FR-004→T020/T021 · FR-005→T030/T031 ·
FR-006→T015 · FR-007→T016 · FR-008→T013/T014 ·
SC-001→T033 · SC-002→T033/T031 · SC-003→T033 · SC-004→T033 · SC-005→T032/T033 · SC-006→T031/T033.
