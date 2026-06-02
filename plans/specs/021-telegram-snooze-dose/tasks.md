# Tasks: Snooze de Dose no Telegram

**Feature Directory**: `plans/specs/021-telegram-snooze-dose`
**Input**: `spec.md`, `plan.md` · **Status**: Dev Ready · **Tier**: 1

---

## Phase 0 — Preflight & Reality Gates (C1)

- [ ] T001 [C1] Confirmar `dose_instances.snoozed_until` + `notified_at` (já existem — `20260528_create_dose_instances.sql`). **Sem migração.**
- [ ] T002 [C1] **GATE**: localizar onde as ações (`take`/`skip`) são definidas/codificadas — `buildNotificationPayload.js:183-184` + `telegramChannel.js:19-22`. **NÃO existe `actionSchema.js`** — não criar.
- [ ] T003 [C1] **GATE**: confirmar a leitura de `user_settings.timezone` via `notificationPreferenceRepository` (`:84`). Confirmações usam tz do usuário, SP só fallback.

## Phase 1 — Helpers Clínicos

- [ ] T004 [US1] `server/bot/_snoozeHelpers.js` [NEW]: `getAvailableSnoozeOptions` (janela 120min).
- [ ] T005 [US3] `isSnoozeEligible` (gap adjacente + circular > 2h; dose única sempre elegível).
- [ ] T006 [P] [C4] `snoozeHelpers.test.js`: opções, elegibilidade (circular, dose única, gap ≤2h).

## Phase 2 — Callbacks do Bot

- [ ] T007 [US1] `doseActions.js`: registrar `snooze_:` / `snooze_pick:` antes dos handlers genéricos.
- [ ] T008 [US1] `handleSnooze`: valida elegibilidade + opções; edita teclado `⏰ 15/30/60`; inelegível → pop-up.
- [ ] T009 [US2] `handleSnoozePick`: re-valida janela; `update snoozed_until`; confirma no **tz do usuário** (T003).

## Phase 3 — Payload + Canal

- [ ] T010 [US2] `buildNotificationPayload.js`: `{id:'snooze'}` em `formatDoseReminder` (entre take/skip) + `applySnoozeDecoration` (⏰ título + linha original HH:MM tz usuário).
- [ ] T011 [US1] `telegramChannel.js`: `case 'snooze'` → `snooze_:${doseInstanceId}` (≤64b; short id se UUID estourar).

## Phase 4 — Cron Runner

- [ ] T012 [US1] `checkSnoozedDoses` em `_snoozeHelpers.js` (busca vencidas `status='pending'`, re-alerta, reseta timestamps).
- [ ] T013 [US1] `api/notify.js`: bloco `withCorrelation` `jobType:'snooze_reminders'` chamando `checkSnoozedDoses`.

## Phase 5 — Validation (C4)

- [ ] T014 [C4] `snoozeHelpers.test.js` 100% + `rtk lint` (bot/core).
- [ ] T015 [C4] `rtk npm run validate:agent`.
- [ ] T016 [C4] Smoke Telegram: adiar edita msg; `snoozed_until` gravado; re-alerta decorado chega no minuto; tomada no app cancela re-alerta.

## Phase 6 — Record (C5)

- [ ] T017 [C5] SQP R-221: minor (server). Bump + CHANGELOG `[Unreleased]`.
- [ ] T018 [C5] events.jsonl + journal + state.json. PR; Gemini + aprovação humana (R-060).

## Dependencies
T001–T003 (gates) antes de tudo. Helpers (T004–T006) `[P]` ao payload (T010–T011). Cron (T012–T013) depende dos helpers.

## Traceability
FR-001→T001/T009 · FR-002→T010 · FR-003→T004 · FR-004→T005 · FR-005→T011 · FR-006→T012/T013 · FR-007→T010.
