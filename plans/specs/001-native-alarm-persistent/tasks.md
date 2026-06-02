# Tasks: Alarme Nativo Persistente (Mobile)

**Feature Directory**: `plans/specs/001-native-alarm-persistent`
**Input**: `spec.md`, `plan.md` · **Status**: Dev Ready · **Tier**: 1

> 2 sprints: A1 (Android) → A2 (iOS). Branch `feat/alarme-nativo`.

---

## Phase 0 — Preflight & Reality Gates (C1)

- [ ] T001 [C1] Build nativa operacional (`rtk expo run:android`/`ios`). **NÃO Expo Go.**
- [ ] T002 [C1] Instalar `@notifee/react-native` + config plugin/permissões em `app.config.js`.
- [ ] T003 [C1] **GATE**: confirmar a API real de leitura de `dose_instances` em `@dosiq/core` (`createDoseInstanceRepository`). Se não houver método que devolva pendentes **com o nome do medicamento** (JOIN protocols→medicines), adicionar `listPendingForAlarms({userId,fromTs,toTs})` no repository (core). `dose_instances` **não tem** `medicine_name`.
- [ ] T004 [C1] **GATE**: ler `logSchema` (`@dosiq/core`) e `registerDose` (`doseService.js:136`) — registrar o payload mínimo obrigatório p/ a chamada do alarme (`quantity_taken` + unidades). Sem inventar update cru de `dose_instances`.

## Phase A1 — Android (Sprint 1)

- [ ] T005 [US1] `alarmService.js`: canal HIGH (`bypassDnd`, `sound:'alarm_dose'`) + `scheduleAlarm`/`cancelAlarm`/`scheduleNag`/`cancelAll`. Import `parseLocalDate` de `@dosiq/core`.
- [ ] T006 [US1] `useAlarmScheduler.js`: look-ahead 72h via repo (T003); re-sync em mutação de protocolo.
- [ ] T007 [US1] Mapear assets `alarm_dose.wav`/`push_chime.wav` nativamente (res/raw + iOS bundle).
- [ ] T008 [US1] `AlarmFullScreen.jsx`: full-screen intent, botões grandes (R-137/138).
- [ ] T009 [US2] `quickDoseRegistration.js`: "Tomei" → `registerDose(logData,{instanceId})` (T004); "Pular" → `status='skipped_user'`; invalidar snapshots. **Sem `taken_at`.**
- [ ] T010 [US1] Nagging reativo (+5 min, máx 3) dentro do handler de background.
- [ ] T011 [US1] Toggle on/off em `SettingsScreen.jsx`.
- [ ] T012 [US1] Integrar `useAlarmScheduler` no app root + coexistência com `expo-notifications` (push usa `push_chime.wav`).

## Phase A2 — iOS (Sprint 2)

- [ ] T013 [US1] Config iOS notifee (`Info.plist`, background modes); critical alert condicional + fallback `timeSensitive`.
- [ ] T014 [US1] `alarmPermission.js`: prompt em ponto de intenção (após 1ª dose registrada).
- [ ] T015 [US2] Adaptar `AlarmFullScreen` p/ notification action buttons iOS.

## Phase 3 — Validation (C4)

- [ ] T016 [P] [C4] Unit: `alarmService.test.js`, `quickDoseRegistration.test.js` (mock `registerDose`; assert que "Tomei" chama `registerDose` com `instanceId` e **não** faz update cru de status).
- [ ] T017 [C4] `rtk lint` (apps/mobile) 0 erros + `rtk npm run validate:agent` green.
- [ ] T018 [C4] Smoke PO (R-234): Doze Mode dispara; "Tomei" gera `medicine_log` + consumo + `dose_instances.status='taken'` com `medicine_log_id`; "Pular" → `skipped_user`; nag; toggle; push remoto intacto.

## Phase 4 — Record (C5)

- [ ] T019 [C5] SQP R-221: bump `app.config.js`, CHANGELOG `[Unreleased]` mobile + store-note.
- [ ] T020 [C5] events.jsonl + journal + `state.json`. PR por sprint; Gemini + smoke PO + aprovação humana (R-060).

## Dependencies
T003/T004 (gates) antes de A1. A1 → A2. T016–T018 após implementação.

## Traceability
FR-001..003 → T005–T008,T010,T013 · FR-004 → T009 (via `registerDose`) · FR-005 → T009 · FR-006 → T006 (T003) · FR-007 → T011 · FR-008 → T012.
