# Analysis: Alarme Nativo v2 (Spec 010) — Reality Check

**Tier:** 2 · **Gerado:** 2026-06-03 (Planning) · **Inputs:** spec.md, plan.md, tasks.md,
ADR-055/056, constitution, CONTRACTS/DECISIONS_INDEX, RULES/APs do bootstrap, **repo real**.

---

## 1. Evidence Table (verificado em disco — find/grep/Read)

| Spec/Plan claim | Real repo (file:line) | Verif? | Nota |
|------|------|------|------|
| Tabela de tratamento = `protocols` | `docs/migrations/20260526_add_weekdays_to_protocols.sql:4` (ALTER protocols ADD COLUMN) | ✅ | `treatment_plans` é só agrupador (join no reminder SELECT) |
| Gerador materializa campos por instância | `packages/core/src/utils/doseInstanceGenerator.js:183-186` | ✅ | add `critical_alarm` aqui |
| `dose_instances.snoozed_until` existe e está ociosa | `docs/architecture/DOSE_INSTANCES.md:58` + grep alarmService=0 hits | ✅ | FR-010 a usa |
| Mobile scheduler filtra pending | `apps/mobile/.../useAlarmScheduler.js:52-53` | ✅ | add filtro `critical` |
| DoseItem shape (sem `critical`) | `packages/core/src/utils/doseZones.js:134-144` | ✅ | aditivo `critical` (CON-024) |
| `<Pular>` já grava `skipped_user` | `apps/mobile/.../quickDoseRegistration.js:68` | ✅ | precedente OK |
| `<Soneca>` NÃO toca DB | grep `snoozed_until/dose_instances/supabase` em alarmService = 0 | ✅ | gap confirmado |
| Reminder lê fonte (pós-011 = dose_instances) | `server/bot/_reminderHelpers.js:18` (hoje `protocols`; **011/ADR-057** troca p/ `dose_instances`) | ✅ | gate lê `dose_instances.critical_alarm` direto (fonte única) — **C3 só pós-011** |
| Reminder agrupa em blocos (kinds) | `_reminderHelpers.js:60-86` (by_plan/misc/individual) | ✅ | bloco misto → split per-dose |
| Gate v1 no expoPushChannel | `server/notifications/channels/expoPushChannel.js:11-25` | ✅ | ressemantizar |
| `native_alarm_enabled` no DB/RPC | `docs/migrations/20260603_native_alarm_enabled_device_flag.sql` | ✅ | base do flag de capacidade |
| iOS interruption level extraível | `apps/mobile/.../alarmService.js:35` (`IOS_INTERRUPTION_LEVEL`) | ✅ | promover condicional |
| Tela de detalhe/edição de tratamento (toggle) | — | ❌ UNVERIFIED | T004 localiza no C1 |
| Mecanismo de split em `partitionDoses` | `server/bot/utils/partitionDoses.js` (existe; lógica não lida) | ⚠️ PARCIAL | T003 decide split no C1 |

## 2. Cross-File Consistency

- spec.md ↔ plan.md ↔ tasks.md ↔ ADR-055/056: **consistentes (pós-reconciliação 2026-06-03)**.
  A intuição do operador no Q3 ("dispatcher/fonte = dose_instances") foi **adotada** via spec 011
  (ADR-057), que vira **pré-requisito** da 010: o reminder passa a ler `dose_instances` →
  **server e mobile** leem `dose_instances.critical_alarm` (fonte única). Isso torna FR-003/Q3
  literalmente verdadeira e **elimina** o hack de duas fontes da versão original do ADR-056
  (split por `protocols.critical_alarm`). `protocols.critical_alarm` fica só como intenção/origem
  da materialização.
- **Sequenciamento:** C3 da 010 depende da 011 mergeada (nova dependência explícita; ver §5).
- Nenhuma contradição de fluxo core remanescente.

## 3. Data-Migration Completeness

- ✅ 2 colunas com **default false** (T010) — nenhuma dose vira crítica retroativa (SC-004).
- ✅ Materialização nas instâncias novas (T011) + re-materialização no edit (T012).
- ✅ `snoozed_until` já existe — sem migração de coluna (só passa a ser escrita).
- ⚠️ Se alguma **view** vier a consumir `critical_alarm`: declarar `security_invoker=true` (AP-201).
- ⚠️ Se a materialização entrar via RPC: AP-209 (DROP+recreate, migration antes do app).

## 4. Coverage

- Todo FR → task (ver Traceability em tasks.md). ✅
- Todo SC → C4 check (T060-T063). ✅
- US1/US2 (P1) → testes independentes (T060/T061) + smoke (T063). ✅
- US3 (P2 iOS) → T050 + smoke fallback. ✅
- Interface tocada: CON-024 (aditivo, T020); payload/rota de notif → ADR-056. ✅

## 5. Severity & Gate

| Sev | Item | Resolução |
|-----|------|-----------|
| **HIGH** | **Dependência da 011**: C3 da 010 exige a 011 (reminder ← dose_instances) mergeada, senão o gate não tem `dose_instances.critical_alarm` na fonte | T001 gate: 011 mergeada + ADR-057 accepted antes da Fase 4 |
| **HIGH** | ADR-055/056 em `proposed` — mudança de payload/rota de notif exige ADR **accepted** antes do C3 (constitution V) | T001 gate: aprovar ADRs antes de codar |
| MEDIUM | 2 paths UNVERIFIED (tela de tratamento; split do partitionDoses) | T003/T004 no C1 antes do código respectivo |
| MEDIUM | Bloco misto crítico×normal (R-191) | ADR-056 split per-dose (T040) |
| LOW | Ressemantização de `native_alarm_enabled` (toggle→capacidade) | documentar na transição (T041/C5) |

**Gate behavior:** sem CRÍTICO. O HIGH é o **aceite dos ADRs** (esperado no fluxo de Planning —
ADRs nascem proposed). O plano é sólido; **C3 só inicia após ADR-055/056 = accepted** (T001) e
a resolução dos 2 MEDIUM de path no C1. Não há contradição cross-file nem migração faltante.

**Honestidade:** Evidence Table tem 2 itens ❌/⚠️ (localizações deferidas a tasks de C1) —
NÃO declaro PASS 100%. O núcleo (dados, scheduler, reminder, gate) está verificado em disco.
