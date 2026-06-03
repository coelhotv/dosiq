# Analysis: Notification stack ← `dose_instances` (Spec 011) — Reality Check

**Tier:** 2 · **Gerado:** 2026-06-03 (Planning) · **Inputs:** spec.md, plan.md, tasks.md,
ADR-057, constitution, CONTRACTS/DECISIONS_INDEX, RULES/APs do bootstrap, **repo real**.

---

## 1. Evidence Table (verificado em disco — Read/grep)

| Spec/Plan claim | Real repo (file:line) | Verif? | Nota |
|------|------|------|------|
| Reminder lê `protocols` + re-expande schedule | `server/bot/_reminderHelpers.js:17-28` (`from('protocols')...contains('time_schedule',[hhmm])`) + `:145-156` | ✅ | alvo da troca de fonte |
| Agrupamento via `partitionDoses` (input = `dosesNow`) | `_reminderHelpers.js:160` + `:40-89` (`_processUserReminderBlock`) | ✅ | preservar; trocar só o input |
| Dedup heurística janela 5 min | `notificationDeduplicator.js:4` (`DEDUP_WINDOW_MINUTES=5`) + `:157` (`shouldSendGroupedNotification`) | ✅ | aposentar p/ kinds de dose |
| `dose_reminder` individual NÃO passa por dedup hoje | `_reminderHelpers.js:42` (só `by_plan`/`misc` chamam `shouldSendGroupedNotification`) | ✅ | `notified_at` melhora (idempotência onde não havia) |
| `notified_at`/`snoozed_until` existem e ociosas | `docs/architecture/DOSE_INSTANCES.md:57-58` + grep repo = 0 escrita/leitura | ✅ | sem migração de schema |
| `dose_instances`: status default pending, UNIQUE(protocol_id,scheduled_for) | DOSE_INSTANCES.md:51-60 | ✅ | base da query de "devidas" |
| status não-lembrar (taken/missed/skipped_*) | DOSE_INSTANCES.md:76-78 | ✅ | filtro do reminder |
| Reminder usa supabase **raw** (não o core repo) | `_reminderHelpers.js:1` (`import { supabase }`) | ✅ | query/escrita ficam server-side; core repo intocado |
| Core repo tem getWindow/upsert/markMissed (não markNotified) | `createDoseInstanceRepository.js:105/49/320` | ✅ | reminder não depende do repo |
| Dispatcher + DLQ já existem | `dispatchNotification.js:110` (`DLQ Integration (Gate 3.5)`) | ✅ | FR-005b reaproveita, não cria |
| Cron entry estável | `api/notify.js:245` → `server/bot/tasks.js:95` | ✅ | wrapper inalterado |
| tz por instante absoluto (`scheduled_for` UTC) | DOSE_INSTANCES.md:146,263 (AP-194) | ✅ | herda tratamento de tz; sem double-shift |
| Arquivo de teste do reminder | — | ⚠️ UNVERIFIED | T004 localiza/cria no C1 |
| Shape exato exigido por `partitionDoses` | `server/bot/utils/partitionDoses.js` (existe; campos não lidos linha-a-linha) | ⚠️ PARCIAL | T002 confirma no C1 |
| Janela do minuto / borda de cron | regra a definir | ⚠️ DECISÃO | T005 define no C1 |

## 2. Cross-File Consistency

- spec.md ↔ plan.md ↔ tasks.md ↔ ADR-057: **consistentes**. Fonte = `dose_instances`;
  idempotência = `notified_at` após sucesso ≥1 canal; dedup heurística aposentada p/ dose;
  cutover + flag. Sem contradição de fluxo core.
- **Reconciliação com 010:** a 010 (ADR-056) hoje propõe gate por `protocols.critical_alarm`
  (hack de duas fontes, porque o reminder lia protocols). A 011 remove a premissa → o gate
  crítico per-dose passa a ler `dose_instances.critical_alarm` direto. Marcado como **insumo de
  re-escopo p/ a 010** (não alterado aqui; o re-plan da 010 ajusta ADR-056). Não é contradição —
  é a dependência declarada (011 é pré-req da 010).

## 3. Data-Migration Completeness

- ✅ **Nenhuma mudança de schema** — `notified_at`/`snoozed_until` já existem (ociosas).
- ✅ Backfill nulo seguro: instâncias antigas com `notified_at NULL` **não** disparam lembrete
  retroativo (janela só pega o minuto corrente; clamp ao presente — DOSE_INSTANCES §4).
- ✅ Cutover por flag (não destrutivo): via legada permanece até estabilizar; rollback sem deploy.
- ⚠️ Dependência operacional: instâncias **devem** estar materializadas (cron 03:00 + JIT,
  ADR-051) antes do reminder ler. Não é migração, é ordem de geração — smoke com conta nova (T044).

## 4. Coverage

- Todo FR → task (Traceability tasks.md). ✅
- Todo SC → C4 check: SC-001→T040/T044, SC-002→T041/T044, SC-003→T042, SC-004→T044,
  SC-005→T043. SC-006 (habilita 010) validado no re-plan da 010, não aqui — **explícito**. ✅
- US1/US2 (P1) → testes independentes (T040/T041) + smoke (T044). US3 (P2) → T042. ✅
- Interface tocada: dispatcher payload (CON-019/021) **inalterado** — `instanceId` é interno ao
  bloco, não vai ao payload do canal → sem novo CON nem breaking. ✅

## 5. Severity & Gate

| Sev | Item | Resolução |
|-----|------|-----------|
| **HIGH** | ADR-057 em `proposed` — mudança de fonte/idempotência exige ADR accepted antes do C3 (constitution V) | T001 gate |
| **HIGH** | Paridade lembrete antigo×novo (frequência semanal/alternada/weekday já materializada nas instâncias vs `isProtocolActiveOnWeekday`) — divergência = perde/dobra lembrete | SC-001/T040 teste de paridade **obrigatório** antes do cutover |
| MEDIUM | Janela do minuto / borda de cron / clamp (R3) | T005 define regra no C1 |
| MEDIUM | Ordem geração vs leitura (instância não materializada, R4) | T044 smoke conta nova |
| MEDIUM | Shape de `partitionDoses` (2 itens ⚠️ na evidência) | T002/T004 no C1 |
| LOW | `dose_reminder` individual ganha idempotência (melhora, não regressão) | — |

**Gate behavior:** sem CRÍTICO. Dois HIGH: (1) **aceite do ADR** (esperado — ADRs nascem
proposed; T001 destrava); (2) **paridade** — não é gap de plano, é o critério de cutover seguro
(SC-001 já cobre, T040 implementa). C3 só inicia após ADR-057 accepted + os 3 MEDIUM de path/regra
resolvidos no C1. Sem contradição cross-file nem migração de schema faltante.

**Honestidade:** Evidence Table tem 3 itens ⚠️ (teste a localizar, shape parcial, janela a
definir) — **NÃO** declaro PASS 100%. O núcleo (fonte atual, agrupamento, dedup, schema ocioso,
dispatcher/DLQ, cron) está verificado em disco. O risco real desta spec é **paridade no cutover**,
não a mecânica — por isso SC-001 é gate, não nice-to-have.
