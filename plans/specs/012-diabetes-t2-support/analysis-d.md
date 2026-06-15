# 012 Fase D — Planning + Reality Check (FR-015b)

**Created:** 2026-06-14 · **Tier:** 1 (slice serverless dentro do épico 012 Tier 2)
**Goal:** corrigir a frase de dose líquida nos pushes/Telegram/alarme crítico (FR-015b).
**Goal type:** fix

## Reality Check — escopo real da Fase D (verificado contra o repo)

| FR | Status real | Evidência |
|----|-------------|-----------|
| FR-013 | ✅ entregue 022 | `consume_stock_fifo` converte UI→ml |
| **FR-013b** | ✅ **entregue B3** | `docs/migrations/20260613_b3_units_per_ml_null_denominador.sql` em prod: `units_per_ml` NULL default + fallback unit-aware na RPC (`gotas→20, UI→100`, linhas 73-76) + backfill (Lantus=100). ADR-065 accepted. |
| FR-013c | ✅ puxado p/ B4 | ADR-067 |
| FR-014 | ✅ existente | R-248 (adesão binária) |
| FR-015 | ✅ auditado | Smokes anteriores (022 líquidos + 012 B*) cobriram surfaces com `ui/ml` + doses `UI` e2e (decisão PO 2026-06-14). |
| **FR-015b** | 🔴 **PENDENTE** | `server/notifications/payloads/_payloadBuilders.js:16` — `formatDose(qty,unit)` local |

**Escopo Fase D = só FR-015b** (push/Telegram/alarme) + smoke. Validação: jest server + dry-run prod.

## Diagnóstico (FR-015b)

`formatDose` local (`_payloadBuilders.js:16`):
- `mg|mcg|g|ml` → `'1 un.'` — **lossy** (perde a quantidade real)
- demais → `` `${qty} ${u}` `` com `u` **lowercase** → "10 ui" (deveria "10 UI")
- usa `dosageUnit` (mg/ml, ui/ml — concentração), **não** `intake_unit` (gotas|ml|UI — unidade de tomada)

2 builders consomem: `buildDailyDigestPayload` (L40, `medicines[]`) e `buildDoseReminderPayload` (L115).

## Evidence Table (target files)

| Claim | Repo (file:line) | Verified |
|-------|------------------|----------|
| `formatDose` local lossy | `server/notifications/payloads/_payloadBuilders.js:16` | ✅ |
| schemas dose sem intake_unit | `_payloadSchemas.js:10-11` (digest) `:130-131` (reminder) | ✅ |
| core formatters disponíveis | `@dosiq/core` exporta `formatIntakeDose`/`formatDoseItem`/`isLiquidMedicine` (utils/index.js:99-107) | ✅ |
| server importa core | `notificationLogRepository.js:2` (`@dosiq/core/schemas`) | ✅ |
| upstream read-path (SELECT) | `server/bot/_reminderHelpers.js`, `server/notifications/payloads/buildNotificationPayload.js` | ⚠️ verificar em C1 (R-267) |

## Arquitetura / Abordagem

1. **Schemas (R-193):** `_payloadSchemas.js` — adicionar `intake_unit`, `units_per_ml`, `dosage_per_pill` (todos `.optional()`/`.nullable()`) aos itens dose de `dailyDigestDataSchema.medicines[]` e `doseReminderDataSchema`. Aditivo (não quebra payloads existentes).
2. **Builder (R-272):** substituir `formatDose` local por decisão via `isLiquidMedicine({dosage_unit, dosage_per_pill, units_per_ml})` → líquido usa `formatIntakeDose(qty, intake_unit)`; sólido usa `formatDoseItem`. Eliminar fallback "1 un.". Case canônico: `UI` upper, `mg`/`ml` lower (os formatters core já fazem — confirmar).
3. **Read-path (R-267):** o código que monta os dados do push (cron/reminder) deve trazer `intake_unit`+`units_per_ml`+`dosage_per_pill` no SELECT e passar ao builder. Verificar/instrumentar em `_reminderHelpers.js` + `buildNotificationPayload.js`.
4. **Testes:** jest server cobrindo sólido (cp) / gotas / ml / UI + case canônico (acrônimo UI upper).

## Failure modes (R-270)

| Input | Degenerado | Esperado |
|-------|-----------|----------|
| `intake_unit` | NULL (sólido) | cai no ramo `formatDoseItem` (cp), nunca "1 un." |
| `units_per_ml` | NULL | formatter não divide (só exibe qty+unidade de tomada) |
| `qty` | 0 / NULL | `formatDose` retornava undefined → manter guarda (sem crash) |
| `intake_unit` | 'ui' lower | exibir 'UI' upper (case canônico) |
| `dosage_unit` | 'mg/0,8ml' | líquido → usa intake_unit, não a concentração crua |

## Contratos / ADRs
- Sem ADR novo. Aditivo aos schemas de payload (R-193) — não-breaking.
- Sem migração de DB. Sem mudança de contrato CON.

## Quality gates
- `rtk npm test --workspace @dosiq/web` n/a (server). Confirmar runner do server (jest node) em C1.
- Lint antes de cada commit.
- SQP: plataforma Backend/Infra; SemVer patch (correção); CHANGELOG [Unreleased]; sem store-note.
- Dry-run prod após merge (push real sólido/UI).

## Tasks

- [ ] T-D1 [C1] Verificar read-path: grep SELECT de `intake_unit`/`units_per_ml`/`dosage_per_pill` no caminho do push (`_reminderHelpers.js`, `buildNotificationPayload.js`, callers do bot)
- [ ] T-D2 Schemas: adicionar campos dose (intake_unit/units_per_ml/dosage_per_pill) em `_payloadSchemas.js` (digest + reminder) — R-193
- [ ] T-D3 Builder: substituir `formatDose` local por formatters core (`isLiquidMedicine`→`formatIntakeDose`/`formatDoseItem`) nos 2 builders — R-272; case canônico
- [ ] T-D4 Read-path: SELECT/shape do push carrega os campos novos e passa ao builder — R-267
- [ ] T-D5 [C4] Testes jest server: sólido/gotas/ml/UI + case UI upper + qty 0/NULL
- [ ] T-D6 [C4] Lint + testes + SQP (patch + CHANGELOG)
- [ ] T-D7 [C5] Journal + state + (AP se bug novo) + dry-run prod pós-merge
