# Tasks: Alarme Nativo v2 (Spec 010)

**Feature Directory**: `plans/specs/010-native-alarm-v2` · **Tier**: 2 · **Status**: Dev Ready (pós-aprovação ADR)
**Input**: spec.md, plan.md, analysis.md · **ADRs**: ADR-055, ADR-056 (proposed → exigem aceite)

> Branch sugerida `feat/alarme-v2`. ADR-055/056 DEVEM ser aceitos antes do C3 (mudança de
> payload/rota de notif — constitution V). **Pré-req: spec 011 (ADR-057) mergeada** — o reminder
> precisa já ler `dose_instances` p/ a Fase 4 ter `critical_alarm` na fonte.

---

## Phase 0 — Gates (C1) — antes de qualquer código

- [ ] T001 [C1] **GATE ADR + 011**: ADR-055 + ADR-056 + ADR-057 aceitos (accepted) **E spec 011 mergeada** (reminder lê `dose_instances`) — sem isso, Fase 4 bloqueada.
- [ ] T002 [C1] Confirmar tabela `protocols` (colunas atuais) e que o toggle vive no protocolo, não em `treatment_plans` (agrupador). `find/grep`.
- [ ] T003 [C1] Ler `partitionDoses.js` — decidir o mecanismo de split crítico×normal (novo kind vs flag no bloco) + impacto no enum Zod (R-193/AP-115). **Nota:** input já vem de `dose_instances` (com `critical_alarm` + `instanceId`) pós-011.
- [ ] T004 [C1] Localizar a tela de detalhe/edição de tratamento (mobile) onde entra o toggle por-tratamento. `find`.
- [ ] T005 [C1] Confirmar assinatura de `createDoseInstanceRepository` p/ add `setSnoozedUntil` + select de `critical_alarm`/`snoozed_until`.

## Phase 1 — Dados (ADR-055)

- [ ] T010 [US1] Migration `protocols.critical_alarm boolean NOT NULL DEFAULT false` + `dose_instances.critical_alarm boolean NOT NULL DEFAULT false`. Grants/RLS template. Verificação: 100% false pós-migração (SC-004). [AP-209 deploy ordering; AP-201 se view]
- [ ] T011 [US1] `doseInstanceGenerator` materializa `critical_alarm` da flag do protocolo (`doseInstanceGenerator.js:183`). Unit do gerador.
- [ ] T012 [US1] Re-materialização no edit do protocolo (`syncInstancesOnWrite` — wipe+regen futuro carrega a flag). FR-009.

## Phase 2 — Mobile scheduler + UX (US1)

- [ ] T020 [US1] `doseZones.buildDoseItemsFromInstances` → DoseItem ganha `critical` (CON-024 aditivo). Atualizar CON-024.
- [ ] T021 [US1] `useAlarmScheduler.syncAlarms` filtra `critical===true` (`useAlarmScheduler.js:53`). Agenda só críticas.
- [ ] T022 [US1] Toggle "Alerta crítico" na tela de detalhe/edição de tratamento (default OFF, cópia idoso-friendly). FR-006.
- [ ] T023 [US1] Ligar o toggle → checar permissão SO no ponto de intenção (R-239); guiar se negada. FR-006b.
- [ ] T024 [US1] Aposentar `AlarmToggleSection` global + hint de migração pros que tinham global ON. FR-004.

## Phase 3 — Soneca → dose_instances (FR-010)

- [ ] T030 [US?] `createDoseInstanceRepository.setSnoozedUntil(instanceId, ts)`.
- [ ] T031 [US?] `scheduleSnooze` grava `snoozed_until=now+5min` (alarmService).
- [ ] T032 [US?] `syncAlarms` respeita `snoozed_until` (não reagenda antes); `quickDoseRegistration` limpa ao resolver (taken/skip). SC-006.

## Phase 4 — Roteamento server (ADR-056)

- [ ] T040 [US2] `_reminderHelpers` (fonte = `dose_instances` pós-011): cada dose já carrega `critical_alarm`; partition **separa** críticas dos blocos de push (não geram push). Preserva R-191 p/ não-críticas. Sem segundo SELECT em `protocols`.
- [ ] T041 [US2] `expoPushChannel`: filtro per-dose-criticality + device-capability (`native_alarm_enabled` ressemantizado; fallback se device sem capacidade). Atualizar testes do gate.
- [ ] T042 [US2] Atualizar enum Zod do dispatcher se T003 introduzir novo kind (R-193/AP-115).

## Phase 5 — iOS Critical Alerts (US3)

- [ ] T050 [US3] Entitlement `...critical-alerts` condicional (R-259 — só quando aprovado); `IOS_INTERRUPTION_LEVEL`→`'critical'` + `critical:true` p/ críticas; fallback `timeSensitive`.

## Phase 6 — Validation (C4)

- [ ] T060 [P][C4] Unit: gerador (critical materializado), DoseItem.critical, scheduler filtra crítica, snooze write/clear.
- [ ] T061 [P][C4] Unit: `expoPushChannel` gate per-dose+capacidade (crítica suprimida em device capaz; fallback; não-crítica passa).
- [ ] T062 [C4] `rtk lint` 0 erros + `rtk npm run validate:agent` + vitest server.
- [ ] T063 [C4] Smoke PO (R-234/constitution VII): 2 tratamentos (A crítico, B normal) → A alarme+sem push, B push+sem alarme; snooze persiste pós-restart; iOS fallback.

## Phase 7 — Record (C5)

- [ ] T070 [C5] SQP R-221: bump mobile minor; CHANGELOG `[Unreleased]` mobile + store-note; server (gate) no-user-impact ou minor.
- [ ] T071 [C5] ADR-055/056 → accepted; CON-024 atualizado; novos R/AP se surgirem; events.jsonl + journal + state.json.

## Dependencies
T001 (ADR aceito) → tudo. T010→T011→T012. T020→T021. T040→T041. T003→T042.

## Traceability
FR-001→T010 · FR-001b→T010/T011 · FR-002→T021 · FR-003→T040/T041 · FR-004→T024 ·
FR-005→T050 · FR-006→T022 · FR-006b→T023 · FR-007→T042 · FR-008→T010 · FR-009→T012 ·
FR-010→T030/T031/T032 · SC-001/002→T063/T061 · SC-003→T050/T063 · SC-004→T010 ·
SC-005→T062/T063 · SC-006→T032/T063.
