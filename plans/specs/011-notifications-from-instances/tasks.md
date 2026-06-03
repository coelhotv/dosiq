# Tasks: Notification stack ← `dose_instances` (Spec 011)

**Feature Directory**: `plans/specs/011-notifications-from-instances` · **Tier**: 2 · **Status**: Dev Ready (pós-aceite ADR)
**Input**: spec.md, plan.md, analysis.md · **ADR**: ADR-057 (proposed → exige aceite)

> Branch sugerida `feat/notif-from-instances`. ADR-057 DEVE ser aceito antes do C3
> (mudança de fonte/idempotência de notif — constitution V). Sem migração de schema.

---

## Phase 0 — Gates (C1) — antes de qualquer código

- [ ] T001 [C1] **GATE ADR**: ADR-057 aprovado (status accepted) — sem isso, C3 bloqueado.
- [ ] T002 [C1] Ler `partitionDoses.js` — confirmar o **shape de `dose`** exigido (campos consumidos) p/ mapear linhas de `dose_instances` sem quebrar o agrupamento (FR-004).
- [ ] T003 [C1] Confirmar JOIN viável `dose_instances`→`protocols`→`medicines`/`treatment_plans` via PostgREST (FKs/embeds) p/ a query de "devidas".
- [ ] T004 [C1] Localizar/definir arquivo de teste do reminder (`server/bot/__tests__/`); confirmar framework (vitest server) e mock supabase.
- [ ] T005 [C1] Definir a **janela do minuto** (borda + clamp ao presente) e o predicado `snoozed_until` — registrar a regra antes de codar (R3/R4).

## Phase 1 — Fonte: ler `dose_instances` (US1)

- [ ] T010 [US1] `fetchDueDoseInstances(userIdsByMinute, correlationId)` em `_reminderHelpers`: query `status='pending'` + janela `scheduled_for` + `notified_at IS NULL` + `snoozed_until` respeitado; JOIN protocols/medicines/treatment_plans. Paginação se >1000 (AP-186).
- [ ] T011 [US1] Mapear cada instância p/ o shape de `dose` (inclui `instanceId`, `medicineName`, `treatmentPlanId/Name`, `dosagePerIntake`, `dosageUnit`, `medicineId`). Alimentar `partitionDoses` sem alterá-lo.
- [ ] T012 [US1] Branch por flag `REMINDER_SOURCE` em `checkRemindersViaDispatcher` (nova via vs `_fetchProtocolsForUsers` legada). Default `'protocols'`. FR-006.

## Phase 2 — Idempotência: `notified_at` (US2)

- [ ] T020 [US2] `_processUserReminderBlock`: após `dispatch` com `result.success`, `update dose_instances set notified_at=now() where id in (instanceIds do bloco)`. FR-002.
- [ ] T021 [US2] Falha total de envio → **não** marca `notified_at` (re-tenta próximo tick). Canais parciais → DLQ existente (Gate 3.5), sem re-disparar bloco. FR-005b.
- [ ] T022 [US2] Remover `shouldSendGroupedNotification` do caminho de dose em `_processUserReminderBlock`; manter dedup só p/ tipos sem ocorrência (digest/stock). FR-005.

## Phase 3 — Snooze respeitado (US3)

- [ ] T030 [US3] Garantir que o predicado `snoozed_until IS NULL OR <= now` exclui ocorrências adiadas (FR-003). Coberto pela query T010; teste dedicado.

## Phase 4 — Validation (C4)

- [ ] T040 [P][C4] Unit **paridade** (SC-001): mesmo conjunto de protocolos/horários → blocos/kinds/destinatários iguais entre via legada e nova (fixture compartilhada).
- [ ] T041 [P][C4] Unit **idempotência** (SC-002): rodar cron 2× no mesmo minuto / retry → 1 lembrete; `notified_at` setado após sucesso, não setado em falha total.
- [ ] T042 [P][C4] Unit **status/snooze** (SC-003): `taken`/`missed`/`skipped_*`/`snoozed_until` futuro → nenhum lembrete.
- [ ] T043 [C4] `rtk lint` 0 erros + `rtk npm run validate:agent` + vitest server.
- [ ] T044 [C4] Smoke PO (constitution VII): flag ON → lembretes saem de `dose_instances`; cron 2× sem duplicata; rollback via env volta ao comportamento antigo (SC-004); conta nova (geração JIT) recebe.

## Phase 5 — Record (C5)

- [ ] T050 [C5] SQP R-221: server minor (comportamento de envio atrás de flag); CHANGELOG `[Unreleased]` server; sem store-note (não-mobile).
- [ ] T051 [C5] ADR-057 → accepted; `DOSE_INSTANCES.md` marca `notified_at` em uso; novos R/AP se surgirem (ex: idempotência por-ocorrência, paridade de cutover); events.jsonl + journal + state.json.

## Dependencies
T001 (ADR aceito) → tudo. T002/T003 → T010 → T011 → T012. T010 → T020 → T021/T022. T010 → T030.

## Traceability
FR-001→T010/T011 · FR-002→T020 · FR-003→T030 · FR-004→T011 · FR-005→T022 · FR-005b→T021 ·
FR-006→T012 · FR-007→(dispatcher inalterado, T020) · FR-008→T010 ·
SC-001→T040/T044 · SC-002→T041/T044 · SC-003→T042 · SC-004→T044 · SC-005→T043/T044 ·
SC-006→(habilita 010; validado no re-plan da 010, não aqui).
