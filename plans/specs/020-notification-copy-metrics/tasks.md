# Tasks: Copy de Notificação & Métricas (Wave N3)

**Feature Directory**: `plans/specs/020-notification-copy-metrics`
**Input**: `spec.md`, `plan.md` · **Status**: Dev Ready · **Tier**: 1

---

## Phase 0 — Preflight & Reality Gates (C1)

- [ ] T001 [C1] **GATE**: ler `notificationLogRepository.js` + `_dispatchHelpers.js:138` — confirmar o ponto único onde o log é criado hoje. A refatoração **move** esse `create` p/ fase 1; **não** adicionar insert paralelo.
- [ ] T002 [C1] **GATE**: confirmar colunas atuais de `notification_log` (`title,body,medicine_name,protocol_name,channels,protocol_id,status,sent_at`) e RLS vigente (não duplicar policy).
- [ ] T003 [C1] **GATE**: confirmar a API de streak server-side em `server/bot/_adherenceHelpers.js` (assinatura + retorno de streak atual/anterior). Não usar `adherenceService` web.

## Phase 1 — DB + Schema

- [ ] T004 [FR-001] Migração `docs/migrations/20260602_notification_log_metrics.sql` (4 colunas aditivas + índices + RLS update condicional). Aplicar local + validar.
- [ ] T005 [FR-002] Sincronizar `packages/core/src/schemas/notificationLogSchema.js` (add 4 campos, mantém existentes).

## Phase 2 — Dispatcher 2-fases + Repositório

- [ ] T006 [US2] Adicionar `update`/`markOpened`/`markAction` em `notificationLogRepository.js`.
- [ ] T007 [US2] Refatorar `_dispatchHelpers.js`: fase 1 (`create status='pending'` + `dose_instance_id`, captura id) → enrich payload (`notificationLogId`) → dispatch → fase 2 (`update` markSent). Fail-safe na fase 1.

## Phase 3 — Copy Lib + Digest

- [ ] T008 [US1] `server/bot/notificationCopy.js` [NEW]: pools por bloco horário + `getSeedHash` + linhas de streak (via `_adherenceHelpers`).
- [ ] T009 [P] [US1] Unit `notificationCopy.test.js`: determinismo (mesma seed→mesmo texto), distribuição (100 seeds cobrem todos os índices), streak (≥30/≥7/quebrado/<7).
- [ ] T010 [US1] `server/bot/tasks.js`: digest enriquecido + substituir textos estáticos por chamadas à lib.

## Phase 4 — Trackers (Web/Mobile/Telegram)

- [ ] T011 [US2] `apps/web/src/App.jsx`: `?notif=id` → `markOpened` idempotente + `history.replaceState`.
- [ ] T012 [US2] `apps/mobile/.../usePushNotifications.js`: clique do push → `markOpened` (offline → DLQ).
- [ ] T013 [US3] `server/bot/callbacks/doseActions.js`: tomadas gravam `action_taken_at` + `action_type` (callback <64 bytes — índice/short se UUID estourar).

## Phase 5 — Validation (C4)

- [ ] T014 [C4] `rtk vitest`/`rtk jest` — zero regressão em formatters/dispatcher; assert log único (sem duplicação).
- [ ] T015 [C4] `rtk lint` + `rtk npm run validate:agent`.
- [ ] T016 [C4] Smoke: clique push popula `opened_at`; RLS bloqueia update de log alheio.

## Phase 6 — Record (C5)

- [ ] T017 [C5] SQP R-221: minor (core+web+server). Bump + CHANGELOG `[Unreleased]`.
- [ ] T018 [C5] events.jsonl + journal + state.json. PR; Gemini + aprovação humana (R-060).

## Dependencies
T001–T003 (gates) antes de tudo. T004/T005 antes de T006/T007. Copy lib (T008–T010) `[P]` ao dispatcher. Trackers dependem da migração (dose_instance_id) + payload (T007).

## Traceability
FR-001→T004 · FR-002→T005 · FR-003→T006/T007 · FR-004→T008–T010 · FR-005→T011–T013.
