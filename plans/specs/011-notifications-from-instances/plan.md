# Plan: Notification stack ← `dose_instances` (+ `notified_at`)

**Spec:** `spec.md` · **Tier:** 2 (Epic / High-Risk) · **Status:** Planned (Planning)
**ADRs:** ADR-057 (fonte do reminder + idempotência `notified_at` + cutover flag, proposed)
**Contracts:** CON-019 (dispatcher payload — inalterado), CON-021 (notif payload — inalterado)
**Pré-requisito de:** spec 010 (re-escopo ADR-056 após esta fundação)

---

## Summary

O reminder de dose deixa de ler `protocols` + re-expandir o schedule e passa a **ler as
ocorrências devidas de `dose_instances`** (mesma fonte do "hoje"/adesão, ADR-048). Idempotência
precisa por-ocorrência via `dose_instances.notified_at` (hoje 100% ociosa) substitui a dedup
heurística por janela de 5 min **para os kinds de dose**. Agrupamento (`partitionDoses`),
dispatcher (CON-019) e camadas L1/L2/L3 (R-200/R-220) **inalterados** — muda só a **fonte** das
doses (input do partition). Rollout por **cutover + feature flag de rollback** (env, sem deploy).

> **Escopo:** SÓ a troca de fonte + `notified_at`. **NÃO** inclui `critical_alarm` nem
> roteamento crítico (isso é a 010). Esta spec entrega a fundação; a 010 sobe em cima.

## Technical Context (evidência real — file:line)

| Peça | Evidência | Nota |
|------|-----------|------|
| Reminder lê `protocols` + re-expande | `server/bot/_reminderHelpers.js:17-28` (`from('protocols').select(...).contains('time_schedule',[hhmm])`) + `:145-156` (deriva `dosesNow`) | **alvo da troca de fonte** |
| Agrupamento em blocos (kinds) | `_reminderHelpers.js:160` (`partitionDoses(dosesNow)`) → `:40-89` (`_processUserReminderBlock`) | preservar; troca só o input |
| Dedup heurística (5 min) | `server/services/notificationDeduplicator.js:4` (`DEDUP_WINDOW_MINUTES=5`) + `shouldSendGroupedNotification:157` | aposentar p/ kinds de dose |
| `shouldSend*` chamado no reminder | `_reminderHelpers.js:45` (grouped) — `dose_reminder` individual NÃO passa por dedup hoje | substituir por gate `notified_at` |
| `notified_at` / `snoozed_until` no schema | `docs/architecture/DOSE_INSTANCES.md:57-58` | **ociosas** (0 leitura/escrita no repo) |
| `dose_instances` colunas | DOSE_INSTANCES.md:51-60 (`scheduled_for`, `status` default `pending`, `notified_at`, `snoozed_until`, UNIQUE protocol_id+scheduled_for) | nenhuma coluna nova |
| Status p/ adesão (não-lembrar) | DOSE_INSTANCES.md:76-78 (`taken`/`missed`/`skipped_*`) | filtrar fora do reminder |
| Repo dose_instances (web/mobile) | `packages/core/src/repositories/createDoseInstanceRepository.js:42` (`getWindow:105`, `upsertMany`, `markMissedDueInstances:320`) | reminder server NÃO usa o repo (usa supabase raw) |
| Reminder usa supabase raw | `_reminderHelpers.js:1` (`import { supabase }`) | nova query/escrita ficam server-side |
| Cron entry | `api/notify.js:245` (`checkReminders(...)`) → `server/bot/tasks.js:95` (`checkRemindersViaDispatcher`) | wrapper estável |
| Dispatcher + DLQ já existem | `server/notifications/dispatcher/dispatchNotification.js:110` (`DLQ Integration (Gate 3.5)`) | FR-005b reaproveita |
| tz por instante absoluto | DOSE_INSTANCES.md:146,263 (`scheduled_for` UTC, nunca HH:MM string — AP-194) | herda tratamento de tz |

## Constitution Check

- **V** (ADR p/ mudança de fonte/idempotência de notif) → **ADR-057** cobre. ✓
- **VI** (SQP) → backend/infra; SemVer: minor server (comportamento de envio muda atrás de flag). CHANGELOG PT. ✓
- **VII** (PO smoke + human merge) → smoke obrigatório (paridade lembrete antigo×novo). ✓
- **I** (health data) → sem mutar prod em teste; fixtures/mocks supabase. ✓
- **III** (server-side aggregation) → lógica permanece no server (reminder/dispatcher). ✓

## Architecture / Approach

### Decisão central (ADR-057)
Trocar a **fonte** do reminder: `protocols`+schedule → `dose_instances` (ocorrências devidas).
Idempotência por `notified_at` (após sucesso ≥1 canal). Dedup heurística aposentada p/ kinds de
dose. Cutover atrás de feature flag de rollback (env). Sem shadow/paralelo runtime (paridade vira
teste, não runtime).

### Camada 1 — Fonte (server reminder)
- Nova função server `fetchDueDoseInstances(userIdsByMinute, correlationId)` em `_reminderHelpers`
  (ou helper irmão): query `dose_instances` **JOIN** `protocols`→`medicines`/`treatment_plans`:
  - `status = 'pending'`
  - `scheduled_for` dentro da **janela do minuto corrente** (instante absoluto UTC; clamp ao
    presente — não pega passado, evita lembrete retroativo, edge "backfill")
  - `notified_at IS NULL`
  - `snoozed_until IS NULL OR snoozed_until <= now` (FR-003)
- Mapear cada linha para o **mesmo shape de `dose`** que `partitionDoses` já consome
  (`protocolId, protocolName, medicineName, treatmentPlanId, treatmentPlanName, dosagePerIntake,
  dosageUnit, medicineId` + **`instanceId`** novo p/ marcar `notified_at`).
- `partitionDoses(dosesNow)` **inalterado** (FR-004); blocos carregam `instanceId` por dose.

### Camada 2 — Idempotência (`notified_at`)
- Em `_processUserReminderBlock`, após `dispatcher.dispatch(...)` retornar `result.success`
  (≥1 canal ok), gravar `notified_at = now()` nas **instâncias do bloco** (`update ... in
  ('id', instanceIds)`), via supabase raw server-side. FR-002.
- Falha total de envio → **não** marca `notified_at` (re-tenta no próximo tick; at-least-once,
  edge "crash pós-envio" aceito — base friends/family). Canais parciais que falharam → **DLQ**
  já existente (Gate 3.5), sem re-disparar o bloco. FR-005b.

### Camada 3 — Aposentar dedup heurística (kinds de dose)
- Remover as chamadas `shouldSendGroupedNotification` do caminho de dose em
  `_processUserReminderBlock` (a idempotência vira `notified_at`). FR-005.
- `notificationDeduplicator` **permanece** para tipos sem ocorrência (`daily_digest` etc.).
- `notification_log` (auditoria/inbox L3) **fica** intacto.

### Camada 4 — Cutover + flag (FR-006)
- Env flag `REMINDER_SOURCE` (`'instances'` | `'protocols'`, default `'protocols'` até cutover).
- `checkRemindersViaDispatcher` ramifica: nova via (`fetchDueDoseInstances`) vs via legada
  (`_fetchProtocolsForUsers`). Rollback = trocar env, sem deploy de código. Após estabilizar,
  via legada vira morta (limpeza em PR futuro).

### Edge handling
- **Ocorrência devida não materializada** (gap de geração): cron de geração (~03:00) + JIT
  (ADR-051) cobrem; a query do reminder não materializa (só lê). Documentar dependência de ordem.
- **Backfill/passado**: janela só pega o minuto corrente (clamp ao presente).
- **Multicanal** (Telegram+push, CON-019): `notified_at` é **por-ocorrência** (após sucesso em
  ≥1 canal), não por-canal.

## Target Files

| Arquivo | Ação | Verif |
|---------|------|-------|
| `server/bot/_reminderHelpers.js` | nova `fetchDueDoseInstances` + branch por flag + write `notified_at` no bloco; remover `shouldSendGroupedNotification` do caminho de dose | ✅ :17/:40/:145/:160 |
| `server/services/notificationDeduplicator.js` | inalterado (mantém p/ digest/stock); só deixa de ser chamado p/ dose | ✅ :157 |
| `server/notifications/dispatcher/dispatchNotification.js` | inalterado (DLQ Gate 3.5 reaproveitado) | ✅ :110 |
| `server/bot/tasks.js` | inalterado (wrapper `:95`) | ✅ |
| `api/notify.js` | inalterado (cron `:245`) | ✅ |
| `server/bot/__tests__/_reminderHelpers.*` ou novo | testes paridade + idempotência + snooze | ⚠️ localizar/criar no C1 |
| `docs/architecture/DOSE_INSTANCES.md` | marcar `notified_at` como **em uso** (era ociosa) | ✅ :57 |
| `CHANGELOG.md` | `[Unreleased]` server | ✅ |

> **Sem migração de schema** — `notified_at`/`snoozed_until` já existem. Backfill nulo OK
> (instâncias antigas com `notified_at NULL` não disparam — janela só pega o presente).

## Contracts and ADRs

- **ADR-057** (proposed) — fonte do reminder = `dose_instances` + idempotência `notified_at` +
  cutover flag + aposentadoria da dedup heurística p/ kinds de dose. **Exige aceite antes do C3.**
- **CON-019/CON-021** — payload do dispatcher/notif **inalterado** (shape do `data` por kind
  mantém; só adiciona `instanceId` interno no bloco, não no payload do canal).
- **Insumo p/ a 010 (ADR-056 re-escopo):** com o reminder lendo `dose_instances`, o gate crítico
  per-dose passa a ler `dose_instances.critical_alarm` **direto** (some o hack de duas fontes
  `protocols.critical_alarm`). A 010 re-planeja ADR-056 sobre esta fundação. Não implementado aqui.

## Risks + Quality Gates

- **R1 (ALTO):** ADR-057 em `proposed` — mudança de fonte/idempotência de notif exige ADR
  **accepted** antes do C3 (constitution V). → T001 gate.
- **R2 (ALTO):** **paridade** lembrete antigo×novo — se a query de "devidas" divergir do schedule
  (ex: `isProtocolActiveOnWeekday`, frequência semanal/alternada já materializada nas instâncias),
  usuário perde/ganha lembrete. → SC-001 teste de paridade obrigatório antes do cutover.
- **R3 (MÉDIO):** janela do minuto — borda de minuto/atraso de cron pode não casar `scheduled_for`
  exato; definir janela tolerante (ex: `[minuto, minuto+59s]` ou clamp `<= now` desde último tick)
  sem reabrir já-notificadas (`notified_at` guarda). → decidir no C1.
- **R4 (MÉDIO):** ordem de geração vs leitura (instância não materializada) — depende do cron
  03:00/JIT. → documentar; smoke com conta nova.
- **R5 (BAIXO):** `dose_reminder` individual hoje **não** passa por dedup; ao introduzir
  `notified_at` ele passa a ter idempotência (melhora, não regressão).
- Gates: `rtk lint` 0 erros · `rtk npm run validate:agent` · vitest server · smoke PO (paridade +
  zero-duplicata rodando cron 2×) · SQP.

## Clarifications (P1.5)

Markers resolvidos no spec.md (Clarifications 2026-06-03):
- **Q1:** `notified_at` após sucesso ≥1 canal; por-ocorrência; canal falho → DLQ; dedup heurística
  aposentada p/ kinds de dose; `notification_log` fica.
- **Q2:** cutover + feature flag de rollback (sem shadow/paralelo runtime).
- **Q3:** agrupamento mantém, troca o input. Nota p/ 010: bloco `by_plan` com 3 protocolos no
  mesmo minuto, 1 crítico → split per-instância dentro do bloco (010/ADR-056 re-escopo).

Nenhuma pergunta nova de Planning (markers já resolvidos pelo operador no Specifying).
