# Prescriptive Plan: Notification Architecture Consolidation (Wave N+1)

Sequencia o refactor de 3 camadas iniciado em `notifications_architecture_refactor_plan.md`, fechando vazamentos residuais identificados pos-merge — principalmente o caso `dose_reminder*` que ficou de fora do plano original. Resultado: arquitetura limpa, contratos estritos, **drop-in ready** para novos canais (WhatsApp, SMS, Email) e novos formatos (HTML inbox, rich push) sem nova rodada de refactor.

> Branch: `fix/wave-12/notification-architecture-consolidation`
> Pre-requisito: refactor original (`notifications_architecture_refactor_plan.md`) ja mergeado.

---

## Architectural Vision (Refinada)

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 1: BUSINESS LOGIC (server/bot/tasks.js + api/notify.js)       │
│  • Decide quando notificar (cron triggers, eligibility, dedupe)      │
│  • Calcula dados crus de dominio (percentages, lists, counts)        │
│  • Particiona doses (partitionDoses.js)                              │
│  • Output: { kind, data } — APENAS dados de dominio                  │
│  • NAO formata strings, NAO escapa Markdown, NAO escolhe emoji       │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ Contract: per-kind Zod data schema
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 2: PRESENTATION (server/notifications/payloads/)              │
│  • Transforma { kind, data } em payload canonico                     │
│  • Owna: Markdown, escape, emoji, greetings, listagens, nudges       │
│  • Owna: actions[] semanticas (intencoes de interacao)               │
│  • Owna: deeplinks                                                   │
│  • Output: { title, body, pushBody, deeplink, actions, metadata }    │
│  • NAO conhece canais, NAO sabe inline_keyboard vs categoryId        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ Contract: notificationPayloadSchema (strict)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 3: DELIVERY (server/notifications/channels/ + dispatcher/)    │
│  • Resolve canais por usuario (resolveChannelsForUser)               │
│  • Aplica suppression: Quiet Hours, Mode (R-200)                     │
│  • Mapeia actions[] -> affordance nativa (inline_keyboard, category) │
│  • Trunca callback_data <64B (Telegram), encode payload (Expo)       │
│  • Loga delivery em notification_inbox                               │
│  • NAO formata conteudo, NAO escolhe emoji, NAO concatena dominio    │
└──────────────────────────────────────────────────────────────────────┘
```

**Mudancas chave vs versao anterior:**
1. `actions[]` agora e parte do contrato canonico (era L3-specific via `inline_keyboard` hardcode).
2. `metadata` e **strict whitelist** (era `passthrough()` permissivo).
3. `context.isRetry` e o canal unico para reenvios (era duplicado em `data.isRetry`).
4. `dose_reminder*` formatado **em L2** com listagem rica (era L3 via `doseFormatters.js`).
5. L1 passa unidades **cruas**; L2 owna `formatMedicineWithStrength`/`formatIntakeQuantity`.

---

## Function Inventory & Impact

### Schema & Contract (Phase 1)

| # | File | Function/Schema | Action | Reason |
|---|:-----|:---|:---|:---|
| 1 | `payloads/buildNotificationPayload.js` | `notificationPayloadSchema` | **EXTEND** | Adicionar `actions: z.array(actionSchema).default([])` |
| 2 | `payloads/buildNotificationPayload.js` | `actionSchema` | **[NEW]** | `{ id: enum, label: string, params: record }` |
| 3 | `payloads/buildNotificationPayload.js` | `metadataSchema` | **[NEW]** | `.strict()` whitelist: `kind`, `builtAt`, `correlationId`, `details?` |
| 4 | `payloads/buildNotificationPayload.js` | `notificationPayloadSchema.metadata` | **REPLACE** | `.passthrough()` → `metadataSchema` |
| 5 | `payloads/buildNotificationPayload.js` | `notificationPayloadSchema.deeplink` | **RELAX** | `z.string().startsWith('dosiq://').nullable()` (admin kinds podem nao ter) |
| 6 | `payloads/buildNotificationPayload.js` | `doseReminderDataSchema` | **[NEW]** | `{ medicineName, time, dosage?, protocolId? }` |
| 7 | `payloads/buildNotificationPayload.js` | `doseReminderByPlanDataSchema` | **[NEW]** | `{ planName, planId, scheduledTime, hour, doses: [...] }` |
| 8 | `payloads/buildNotificationPayload.js` | `doseReminderMiscDataSchema` | **[NEW]** | `{ scheduledTime, hour, doses: [...], protocolIds }` |
| 9 | `payloads/buildNotificationPayload.js` | `buildNotificationPayload` signature | **REFACTOR** | `({ kind, data, context = {} })` — `context.isRetry` substitui `data.isRetry` |

### L2 Absorption (Phase 2)

| # | File | Function | Action | Reason |
|---|:-----|:---|:---|:---|
| 10 | `payloads/buildNotificationPayload.js` | `case 'dose_reminder_by_plan'` | **REWRITE** | Absorver logica de `formatDoseGroupedByPlanMessage` (listagem rica + emoji + `… e mais N`) |
| 11 | `payloads/buildNotificationPayload.js` | `case 'dose_reminder_misc'` | **REWRITE** | Absorver logica de `formatDoseGroupedMiscMessage` |
| 12 | `payloads/buildNotificationPayload.js` | `case 'dose_reminder'` | **EXPAND** | Listar medicamento com dosagem formatada (paridade com Telegram atual) |
| 13 | `payloads/buildNotificationPayload.js` | builder helpers | **ADD** | Emitir `actions[]` para `dose_reminder*` (`take`, `snooze`, `skip`, `take_plan`, `take_misc`, `details`) |
| 14 | `bot/utils/notificationHelpers.js` | `getTimeOfDayEmoji` | **MOVE FROM** `bot/utils/doseFormatters.js` | Helpers de L2 vivem em um unico lugar |
| 15 | `bot/utils/doseFormatters.js` | `formatDoseGroupedByPlanMessage` | **DELETE** | Logica absorvida por L2 |
| 16 | `bot/utils/doseFormatters.js` | `formatDoseGroupedMiscMessage` | **DELETE** | Logica absorvida por L2 |
| 17 | `bot/utils/doseFormatters.js` | (arquivo) | **DELETE** | Apos itens 14-16, arquivo fica vazio |

### L1 Cleanup (Phase 3)

| # | File | Function | Action | Reason |
|---|:-----|:---|:---|:---|
| 18 | `bot/tasks.js` | `checkRemindersViaDispatcher` doses build | **REFACTOR** | Passar `medicineName`, `dosagePerIntake`, `dosageUnit` **crus**; remover chamada a `formatMedicineWithStrength` em L1 |
| 19 | `bot/tasks.js` | `runDailyDigestViaDispatcher` schedule build | **REFACTOR** | Idem item 18 — passar dados crus de medicamento |
| 20 | `bot/tasks.js` | `runDailyAdherenceReportViaDispatcher` storytelling | **REFACTOR** | Remover string `'📈 Melhora de...'` com emoji inline. Passar `{ percentageYesterday, deltaPercent }` cru; L2 monta storytelling |
| 21 | `bot/tasks.js` | demais schedulers (titulacao, prescricao, estoque) | **AUDIT** | Confirmar que nenhum constroi string presentation; corrigir se houver |
| 22 | `payloads/adherenceReportDataSchema` | `storytelling` field | **REMOVE** | Ja nao vem como string; substituir por `{ comparison?: { previousPercentage, deltaPercent } }` |

### L3 Cleanup (Phase 4)

| # | File | Function | Action | Reason |
|---|:-----|:---|:---|:---|
| 23 | `channels/telegramChannel.js` | `formatMessage` | **DELETE** | Logica era L2 vazada; canal apenas concatena `title + body` ou usa `body` puro |
| 24 | `channels/telegramChannel.js` | kind inference por deeplink (L86-88) | **DELETE** | `payload.metadata.kind` e autoritativo; remover heuristica |
| 25 | `channels/telegramChannel.js` | `inline_keyboard` hardcode | **REFACTOR** | Mapeador generico: `payload.actions.map(a => ({ text: a.label, callback_data: encodeCallback(a) }))` |
| 26 | `channels/telegramChannel.js` | `escapeMarkdownV2(payload.title)` | **DELETE** | L2 ja entrega `title` escapado (consistencia com `body`) |
| 27 | `channels/telegramChannel.js` | wrapping `*${title}*\n${body}` | **DELETE** | L2 entrega `body` ja com titulo formatado quando aplicavel; canal envia `body` puro |
| 28 | `channels/telegramChannel.js` | `encodeCallback` (helper local) | **[NEW]** | Trunca/encoda `actions[]` -> `callback_data` <64B (R-030) |
| 29 | `channels/expoPushChannel.js` | leitura de payload | **AUDIT** | Confirmar que usa `pushBody` (nao `body`) e nao le `metadata` cru |
| 30 | `channels/expoPushChannel.js` | actions support | **DEFER** | Documentar gap: Expo `categoryIdentifier` requer registro no app cliente; tratar como follow-up separado |

### Dispatcher & Boundary (Phase 5)

| # | File | Function | Action | Reason |
|---|:-----|:---|:---|:---|
| 31 | `dispatcher/dispatchNotification.js` | `payload \|\| buildNotificationPayload(...)` fallback | **REMOVE** | Contrato unico: dispatcher **sempre** chama o builder. Callers passam `{ kind, data, context }` apenas |
| 32 | `dispatcher/dispatchNotification.js` | `protocolId` inference por string match | **REFACTOR** | Derivar de schema per-kind ou de `payload.metadata.details.protocolId` |
| 33 | `dispatcher/dispatchNotification.js` | `provider_metadata` log build | **REFACTOR** | Whitelist explicita do que vai para `notification_inbox.provider_metadata` |
| 34 | `api/dlq/_handlers/retry.js` | `data: { ...payload, isRetry: true }` | **REFACTOR** | Passar `data: payload.data, context: { isRetry: true, originalNotificationId }`. Remover `isRetry` de `data` |
| 35 | `api/notify.js` | `notificationDispatcher.dispatch` proxy | **AUDIT** | Confirmar que e thin proxy (foi GATE 3 do plano anterior); apenas verificar |

### Frontend & Validation (Phase 6)

| # | File | Function | Action | Reason |
|---|:-----|:---|:---|:---|
| 36 | `apps/web/src/services/api/dlqService.js` | `formatNotificationType` | **AUDIT** | Confirmar paridade com `kindSchema` backend. Adicionar labels faltantes |
| 37 | `apps/web/src/components/inbox/*` (descobrir) | Renderer | **VERIFY** | Confirmar que renderiza `body` Markdown corretamente. Inbox deve ter mesma riqueza visual do Telegram |
| 38 | `notification_inbox` table | `body_format` column | **DEFER** | Plano original ja gravava Markdown em `body`. Adicionar coluna explicita `'markdown'` vs `'plain'` fica como follow-up se houver demanda real |
| 39 | `docs/architecture/NOTIFICATIONS.md` | Documentacao | **UPDATE** | Diagrama 3-tier atualizado, contratos `actions[]` + `context`, adicionar guia "como adicionar novo canal" |

---

## Execution: Gates with Mandatory Approval + Atomic Commits

> [!IMPORTANT]
> Apos aprovacao de cada Gate: **Lint → Atomic Commit → push para feature branch**.
> Branch: `fix/wave-12/notification-architecture-consolidation`
> Cada Gate e atomico mas constroi sobre o anterior — nao pular ordem.

---

### 🟡 GATE 1 — Schema & Contract Hardening

> **Exec Spec**: [EXEC_SPEC_GATE_1_schema_contract.md](EXEC_SPEC_GATE_1_schema_contract.md)

**Files**: `payloads/buildNotificationPayload.js`

**Scope**:
1. Adicionar `actionSchema` (`{ id, label, params? }`) e `metadataSchema` (strict whitelist).
2. Substituir `metadata.passthrough()` por `metadataSchema` em `notificationPayloadSchema`.
3. Adicionar `actions: z.array(actionSchema).default([])` ao payload schema.
4. Relaxar `deeplink` para `.nullable()`.
5. Mudar signature: `buildNotificationPayload({ kind, data, context = {} })`.
6. Mover decoracao `isRetry` para ler de `context.isRetry` (nao mais `data.isRetry`).
7. Adicionar `doseReminderDataSchema`, `doseReminderByPlanDataSchema`, `doseReminderMiscDataSchema`.
8. **Importante**: callers ainda passam `data.isRetry` neste gate (nao quebrar) — adicionar shim temporario que ler ambos com warning. Remocao do shim no GATE 5.

**Gate Report**: Diff dos schemas, prova de que payload existente continua valido (rodar suite de testes), lista de novos schemas.
**On Approval**: `npm run lint` → `git commit -m "feat(notifications): adiciona actions[], metadata strict e schemas dose_reminder (L1→L2)"`

---

### 🟡 GATE 2 — L2 Absorption: dose_reminder family

> **Exec Spec**: [EXEC_SPEC_GATE_2_l2_absorption.md](EXEC_SPEC_GATE_2_l2_absorption.md)

**Files**: `payloads/buildNotificationPayload.js`, `bot/utils/notificationHelpers.js`, `bot/utils/doseFormatters.js`

**Scope**:
1. Mover `getTimeOfDayEmoji` de `doseFormatters.js` para `notificationHelpers.js`.
2. Implementar formatacao rica em L2 para:
   - `dose_reminder` (caso individual com listagem de medicamento)
   - `dose_reminder_by_plan` (absorver `formatDoseGroupedByPlanMessage`)
   - `dose_reminder_misc` (absorver `formatDoseGroupedMiscMessage`)
3. Cada caso emite `actions[]`:
   - `dose_reminder` → `[take, snooze, skip]`
   - `dose_reminder_by_plan` → `[take_plan, details]`
   - `dose_reminder_misc` → `[take_misc, details]`
4. **Deletar** `bot/utils/doseFormatters.js` (arquivo inteiro fica vazio apos itens 1-3).
5. Atualizar imports orfaos via `grep -r doseFormatters server/ apps/`.

**Gate Report**: Diff completo. Comparacao "antes/depois" das mensagens (Telegram + Push + Inbox) para garantir paridade visual ou ganho. Confirmar arquivo `doseFormatters.js` deletado.
**On Approval**: `npm run lint` → commit: `refactor(notifications): absorve formatters dose_reminder em L2 e emite actions[]`

---

### 🟡 GATE 3 — L1 Cleanup: tasks.js purge presentation

> **Exec Spec**: [EXEC_SPEC_GATE_3_l1_cleanup.md](EXEC_SPEC_GATE_3_l1_cleanup.md)

**Files**: `bot/tasks.js`

**Scope**:
1. `checkRemindersViaDispatcher`: passar `doses[]` com campos crus (`medicineName`, `dosagePerIntake`, `dosageUnit`, `dosagePerPill`). Remover chamadas a `formatMedicineWithStrength` e `formatIntakeQuantity`.
2. `runDailyDigestViaDispatcher`: idem — passar `medicines[]` cru.
3. `runDailyAdherenceReportViaDispatcher`: substituir construcao de `storytelling` string por `comparison: { previousPercentage, deltaPercent, trend: 'up'|'down'|'flat' }`. L2 monta a frase com emoji.
4. Atualizar `adherenceReportDataSchema` (em L2) para refletir mudanca: trocar `storytelling: string` por `comparison: object`.
5. **Auditar** demais runners (`checkStockAlertsViaDispatcher`, `checkTitrationAlertsViaDispatcher`, `checkPrescriptionAlertsViaDispatcher`, `sendDLQDigest`): se ja estao limpos (passam dados crus), apenas anotar OK no report. Se nao, refatorar.
6. L2 absorve `formatMedicineWithStrength`/`formatIntakeQuantity` (importa de `notificationHelpers.js`).

**Gate Report**: Diff de `tasks.js` mostrando remocao de chamadas presentation. Lista das funcoes auditadas com OK/Refactored. Diff do `adherenceReportDataSchema` atualizado.
**On Approval**: `npm run lint` → commit: `refactor(tasks): L1 passa dados crus de dominio; L2 owna toda formatacao`

---

### 🟡 GATE 4 — L3 Cleanup: channels become pure delivery

> **Exec Spec**: [EXEC_SPEC_GATE_4_l3_cleanup.md](EXEC_SPEC_GATE_4_l3_cleanup.md)

**Files**: `channels/telegramChannel.js`, `channels/expoPushChannel.js`

**Scope**:
1. **telegramChannel**:
   - Deletar `formatMessage()` inteiro.
   - Deletar inferencia de `kind` por deeplink parsing.
   - Deletar `escapeMarkdownV2(payload.title)` (L2 ja entrega escapado).
   - Deletar wrapping `*${title}*\n${body}` (L2 entrega `body` final).
   - Deletar imports de `formatDoseGroupedByPlanMessage`/`Misc` (ja deletados em GATE 2).
   - Substituir construcao hardcoded de `inline_keyboard` por mapeador generico:
     ```js
     const inline_keyboard = payload.actions.length > 0
       ? [payload.actions.map(a => ({ text: a.label, callback_data: encodeCallback(a) }))]
       : undefined;
     ```
   - Implementar `encodeCallback(action)`: serializa `${action.id}:${Object.values(action.params).join(':')}`, trunca <64B (R-030).
   - Canal envia `bot.sendMessage(chatId, payload.body, { parse_mode: 'MarkdownV2', reply_markup })`.
2. **expoPushChannel**: auditar — confirmar que usa `payload.pushBody`, nao le `metadata.*` cru fora do whitelist. Documentar gap de `actions[]` (Expo requer `categoryIdentifier` registrado no client; fora de escopo deste plano).
3. Atualizar callbacks Telegram (`bot/callbacks/`) se o formato de `callback_data` mudar — manter compatibilidade com formato existente (`take_:`, `snooze_:`, `skip_:`, `takeplan:`, `takelist:`, `details:`).

**Gate Report**: Diff de `telegramChannel.js` (esperado: arquivo cair de ~165 linhas para <80). Confirmacao via `grep` de que callbacks continuam parseando `callback_data` corretamente. Smoke test: enviar `dose_reminder_by_plan` em ambiente local e verificar mensagem identica/melhor.
**On Approval**: `npm run lint` → commit: `refactor(channels): canais viram delivery puro; actions[] mapeadas para affordances nativas`

---

### 🟡 GATE 5 — Dispatcher & Boundary

> **Exec Spec**: [EXEC_SPEC_GATE_5_dispatcher_boundary.md](EXEC_SPEC_GATE_5_dispatcher_boundary.md)

**Files**: `dispatcher/dispatchNotification.js`, `api/dlq/_handlers/retry.js`, `api/notify.js`

**Scope**:
1. **dispatcher**:
   - Remover fallback `payload || buildNotificationPayload(...)`. Signature unica: `dispatch({ userId, kind, data, context, channels?, ... })`.
   - Builder e **sempre** chamado internamente.
   - Remover string-match `isGroupedKind` para inferir `protocolId`. Derivar de schema (`data.protocolId` para singular kinds, `null` para grouped).
   - `provider_metadata` no log: whitelist explicita (ex: `{ telegram_message_id, expo_ticket_id, isRetry }`), nao spread amplo.
2. **dlq retry**: `data: payload.data, context: { isRetry: true, originalNotificationId: ... }`. Remover `isRetry` de `data`.
3. **api/notify.js**: confirmar via leitura que `notificationDispatcher.dispatch` continua thin proxy (foi GATE 3 do plano original). Apenas snapshot no report.
4. Remover shim de `data.isRetry` introduzido no GATE 1 (callers agora todos usam `context.isRetry`).

**Gate Report**: Diff dispatcher. Confirmacao via `grep -r "data.isRetry" server/ api/` retornar zero ocorrencias. Snapshot de `api/notify.js` proxy.
**On Approval**: `npm run lint` → commit: `refactor(dispatcher): contrato unico; isRetry vive em context; protocolId derivado de schema`

---

### 🟡 GATE 6.5 — Inbox Markdown Renderer (Bug Fix Visual)

> **Exec Spec**: [EXEC_SPEC_GATE_6_5_inbox_renderer.md](EXEC_SPEC_GATE_6_5_inbox_renderer.md)

**Files**: `apps/web/src/features/inbox/*` (descobrir), `apps/mobile/src/features/inbox/*` (descobrir)

**Contexto**: Hoje `notification_inbox.body` armazena MarkdownV2 (mesmo formato consumido pelo Telegram), mas o renderer Inbox (web e mobile) exibe como texto puro — usuario ve `*bold*` literal, escapes `\\!`, etc. Bug visual real, nao de arquitetura.

**Scope**:
1. **Web**: Adicionar parser MarkdownV2 → React no Inbox renderer. Suportar minimo: `*bold*`, `_italic_`, escapes (`\\!`, `\\.`, `\\(`, `\\)`), quebras de linha. Bibliotecas candidatas: `react-markdown` com plugin custom para escapes Telegram, ou parser proprio (~50 linhas).
2. **Mobile (Expo)**: Mesma logica usando `react-native-markdown-display` ou parser custom para `<Text>` nesting.
3. Padronizar: o que o Telegram exibe **deve ser visualmente equivalente** ao que o Inbox exibe. Smoke test lado-a-lado.
4. **NAO** mudar L2 ou schema. Bug e estritamente de renderer. Esta correcao nao bloqueia o caminho 3 (content-tree + adapters) descrito em `notifications_architecture_vision.md` — apenas remove o sintoma agudo.

**Gate Report**: Screenshots before/after de `dose_reminder_by_plan` e `daily_digest` no Inbox web e mobile. Confirmacao de que escapes nao aparecem mais literais.
**On Approval**: `npm run lint` → commit: `fix(inbox): renderiza MarkdownV2 do body para paridade visual com Telegram`

---

### 🟢 GATE 6 — Validation, Frontend Sync & Documentation

> **Exec Spec**: [EXEC_SPEC_GATE_6_validation_docs.md](EXEC_SPEC_GATE_6_validation_docs.md)

**Files**: `apps/web/src/services/api/dlqService.js`, `apps/web/src/components/inbox/*`, `docs/architecture/NOTIFICATIONS.md`

**Scope**:
1. `formatNotificationType` (frontend): paridade com `kindSchema` backend. Rodar diff manual.
2. Inbox renderer (web e mobile): confirmar que renderiza `body` Markdown com mesma riqueza do Telegram para `dose_reminder*`. Se nao, ajustar renderer (nao L2).
3. `npm run validate:agent` (10-min kill switch).
4. Smoke test end-to-end:
   - Disparar `dose_reminder_by_plan` (cron simulator) → inspecionar Telegram, Inbox, Push.
   - Disparar `daily_digest` → idem.
   - Disparar DLQ retry → verificar `(Reenvio)` aparece e `context.isRetry` chegou no log.
5. Atualizar `docs/architecture/NOTIFICATIONS.md`:
   - Diagrama 3-tier final.
   - Documentar contratos `actionSchema`, `metadataSchema`.
   - Secao "Como adicionar novo canal" (passos: criar `channels/myChannel.js`, mapear `actions[]`, registrar em `dispatcher`).
   - Secao "Como adicionar novo kind" (passos: schema em L2, case no builder, opcional channel-specific affordance).
6. Criar PR, aguardar AI review, aguardar aprovacao humana explicita.

**Gate Report**: Output de `validate:agent`, screenshots dos canais, link da PR.

---

## Risk Management

| Risk | Mitigation |
|:---|:---|
| `actions[]` quebra callbacks existentes | GATE 4 mantem formato `callback_data` legado (`take_:`, `takeplan:`, etc); apenas a **construcao** muda, nao o formato wire |
| `metadata.strict()` quebra logs/analytics que liam campos crus | GATE 1 desenha whitelist com base em **uso real** auditado em `notification_inbox.provider_metadata` antes de aplicar |
| Inbox renderer assume formato antigo | GATE 6 inclui smoke test visual; se renderer nao acompanha riqueza, ajusta-se renderer (nao L2) |
| `dose_reminder*` perde paridade visual com Telegram atual | GATE 2 report exige comparacao before/after; usuario aprova baseado em screenshots |
| Schema `comparison` em adherence_report quebra producao | GATE 3 atualiza schema **junto** com caller; teste em dev antes de merge |
| Callers fora do mapa (ex: comandos /status que reusam formatters?) | Survey ja confirmou que `bot/commands/*` e `bot/callbacks/*` nao usam pipeline de notificacao — sao response-to-command, scope diferente. Nao tocados. |
| Expo Push gap em `actions[]` | Documentado como dividend tecnica; nao bloqueia esta wave |
| Cliente Mobile (Expo) nao reconhece novos `categoryIdentifier` | Fora de escopo (item 30, defer). Push continua funcionando sem actions interativas, igual hoje |

---

## Out of Scope (Follow-ups)

- **Expo Push interactive actions** (`categoryIdentifier` + `UNNotificationAction`): requer mudanca no app cliente Expo; tratar em wave separada quando houver demanda.
- **`notification_inbox.body_format` column**: discriminar `'markdown'` vs `'plain'` no banco. Hoje tudo e Markdown; criar coluna so se houver formato novo.
- **Web/Mobile Inbox renderer overhaul**: se o renderer atual ja entrega visual aceitavel, nao mexer. So entra em wave propria se houver gap visual confirmado.
- **Novo canal real (WhatsApp/SMS/Email)**: arquitetura deste plano deixa drop-in ready; implementacao real entra quando produto pedir.
- **R-NNN / AP-NNN registry no DEVFLOW**: registrar aprendizados arquiteturais apos merge (`/devflow C5`).
- **Content tree + format adapters (visao Caminho 3)**: ver `notifications_architecture_vision.md`. Adiar ate 4o canal.
- **Per-kind builder modules**: split do switch em `buildNotificationPayload.js` quando ultrapassar 15 kinds.
- **Domain events explicitos**: introduzir bus de eventos quando 1o caso real-time (nao-cron) emergir.
- **Per-kind channel preferences por usuario**: feature de produto, nao deste plano.

## ADRs Registrados (pre-merge)

Decisoes conscientes documentadas em `.agent/memory/decisions/infra_and_deploy/`:
- **ADR-037**: Adiamento de content-tree + adapters ate 4o canal (YAGNI consciente).
- **ADR-038**: Manutencao de scheduler-pull; domain events entram quando emergir caso real-time.
- **ADR-039**: Switch unico de kinds em `buildNotificationPayload.js` ate 15 kinds; depois split por modulo.

---

## Success Criteria

- [ ] `grep -r "doseFormatters" server/ apps/` retorna zero
- [ ] `grep -r "data.isRetry" server/ api/` retorna zero
- [ ] `grep -r "passthrough" server/notifications/payloads/` retorna zero
- [ ] `telegramChannel.js` < 100 linhas (hoje ~165)
- [ ] `buildNotificationPayload.js` ainda compreensivel (<700 linhas) — se ultrapassar, dividir builder por kind em arquivos separados (refactor cosmetico, nao parte deste plano)
- [ ] `npm run validate:agent` passa
- [ ] Mensagens `dose_reminder*` em Inbox e Push tem paridade visual com Telegram
- [ ] Documentacao `docs/architecture/NOTIFICATIONS.md` reflete arquitetura final com guia de extensao
