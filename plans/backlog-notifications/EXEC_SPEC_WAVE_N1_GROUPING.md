# Exec Spec — Wave N1: Agrupamento por Treatment Plan + Bulk Mobile

> **Status:** EM EXECUÇÃO — 4/8 sprints concluídos (N1.1 pendente, N1.2–N1.5 ✅)
> **Master Plan:** [`MASTER_PLAN_NOTIFICATIONS_REVAMP.md`](./MASTER_PLAN_NOTIFICATIONS_REVAMP.md)
> **Idea Plan:** [`IDEA_PLAN_NOTIFICATIONS_REVAMP.md`](./IDEA_PLAN_NOTIFICATIONS_REVAMP.md) — §Wave N1
> **PRs:** #496 (N1.1+N1.2, backend), #498 (N1.3+N1.4, mobile deeplink), #499 (N1.4 fixes), #500 (N1.5 bulk modal) — todos mergeados ✅
> **Estimativa:** ~3 dias úteis · 8 sprints · Início: 2026-W17

---

## 1. Objetivo

Substituir o "1 push por protocolo" por **1 push por bloco semântico**, preservando identidade de `treatment_plan_id` em multimorbidade. Estender o canal mobile native com deeplink real e bulk register modal.

**Resolve diretamente o screenshot** (`screenshots/notificacoes-lockscreen.png`) sem migration de DB.

---

## 2. Pré-requisitos

| Item | Estado |
|------|--------|
| `protocols.treatment_plan_id` existente | ✅ (`apps/web/src/schemas/protocolSchema.js:75–77`) |
| `treatmentPlanService` server-readable | ✅ (`apps/web/src/features/protocols/services/treatmentPlanService.js`) |
| `LogForm type='plan'` (web) | ✅ (`apps/web/src/shared/components/log/LogForm.jsx:151–160`) |
| Dispatcher multicanal | ✅ (`server/notifications/dispatcher/dispatchNotification.js`) — ADR-029 |
| `notificationDeduplicator` 5min window | ✅ (`server/services/notificationDeduplicator.js`) |
| Mobile Notification Inbox | ✅ (`apps/mobile/src/features/notifications/`) |
| Mobile Push setup | ✅ (`apps/mobile/src/platform/notifications/usePushNotifications.js`) — **mas tap handler é stub** |

---

## 3. Convenção de Alocação de Agente

| Categoria | Modelos | Quando usar |
|-----------|---------|-------------|
| **🟢 Avançado** | Claude Sonnet, Gemini Pro, GPT Codex | Lógica nova com decisões arquiteturais; refactors multi-arquivo coordenados; testes não-triviais; código que toca contratos críticos (notificações, callbacks, dedup); novos componentes RN com edge cases (cold start, navigation timing) |
| **🟡 Rápido** | Claude Haiku, Gemini Fast, GPT Mini | Edits cirúrgicos em arquivos isolados; extensão de mapas/enums com spec clara; UI form fields com design system existente; tests unitários quando spec já está pronta; migrations simples; updates de copy |
| **⚪ Humano** | — | Validações manuais (sandbox bot, device físico, lock screen) |

> **Regra-mãe**: se um sprint pode ser descrito como "edite `X.jsx` para adicionar a entrada `Y` no objeto `Z` conforme tabela abaixo", é 🟡 Rápido. Se requer entender comportamento dinâmico, escolher entre alternativas, ou coordenar mudanças em 3+ arquivos, é 🟢 Avançado.

---

## 4. Sprints

### Sprint 1.1 — Backend: partição de doses + formatters (`tasks.js` + `notify.js`) ✅

**Status:** CONCLUÍDO (PR #496) ✅

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Justificativa**: lógica nova de partição com 9 cenários (A–I), edge case do cenário G, dois formatters MarkdownV2 com truncamento, refactor não-trivial de `checkRemindersViaDispatcher`. Erros silenciosos aqui virariam regressão direta para todos os usuários.

**Entregas**:

1. Em `server/bot/tasks.js`:
   - Refatorar `checkRemindersViaDispatcher:325–399`: substituir loop "1 dispatch por protocolo" por:
     - Coletar `dosesNow[]` (JOIN `protocols` + `treatment_plans`) onde `time_schedule.includes(currentHHMM)`
     - Aplicar `partitionDoses(dosesNow)` (helper novo) → array de blocos `{ kind: 'by_plan'|'misc'|'individual', planId?, planName?, doses[] }`
     - Para cada bloco: chamar `dispatcher.dispatch()` com `kind` apropriado (`dose_reminder_by_plan`, `dose_reminder_misc`, `dose_reminder`)
   - Implementar `partitionDoses` conforme regra do Master Plan §3 P2 (planos com ≥2 doses → bloco; sobra ≥2 → misc; sobra 1 → individual; sobra com planos distintos ≤3 → individuais por plano).
   - Criar `formatDoseGroupedByPlanMessage(planName, doses, scheduledTime)` e `formatDoseGroupedMiscMessage(doses, scheduledTime)` em MarkdownV2. Truncar para 10 doses + "_… e mais N_" se necessário.

2. Em `api/notify.js`:
   - Adicionar cases `'dose_reminder_by_plan'` e `'dose_reminder_misc'` em `buildNotificationPayload:47–79`.
   - Title contextual via helper `getTimeOfDayGreeting(hour)` (manhã 🌅 / almoço 🍽️ / tarde ☕ / noite 🌆 / madrugada 🌙).
   - Body resumido: `"Quarteto Fantástico (4) — 08:00"` ou `"3 medicamentos pendentes — 14:00"`.
   - Deeplinks: `dosiq://today?at=HHMM&plan=${planId}` e `dosiq://today?at=HHMM&misc=1`.
   - `metadata.protocol_ids = [...]` populado.

3. Tests unitários em `server/bot/__tests__/`:
   - `partitionDoses.test.js` — fixture para cada cenário A–I.
   - `formatters.test.js` — render esperado de 1/4/12 doses (truncamento).

**Critério de aceite**:
- `partitionDoses` retorna arrays corretos para os 9 cenários.
- Formatters geram MarkdownV2 válido (escape correto, sem chars não-escapados).
- `checkRemindersViaDispatcher` emite N dispatches por bloco para fixture multi-plano (não 1 por protocolo).

---

### Sprint 1.2 — Backend: callback handlers `takeplan` / `takelist` ✅

**Status:** CONCLUÍDO (PR #1)

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Justificativa**: porta de lógica `LogForm type='plan'` para o server-side com bulk-log via `medicineLogService` ou equivalente; necessita resolver protocolos por `(userId, HHMM, planId)` ou `(userId, HHMM, protocolIds[])`; respeitar `callback_data < 64 bytes` (R-030 — usar índices numéricos em sessão).

**Entregas**:

1. Em `server/bot/callbacks/doseActions.js`:
   - Novo handler `takeplan` (`callback_data: takeplan:${planIdx}:${HHMM}`):
     - Buscar protocolos do user com `treatment_plan_id` correspondente cujo `time_schedule.includes(HHMM)`
     - Registrar todas as doses via porta server-side de `LogForm.jsx:151–160` (criar `medicineLogService.createMany(logs)` se ainda não existir)
     - Decrementar estoque (R-040 — ordem: validar → registrar → decrementar)
     - Responder no Telegram: `"✅ X doses do [plano] registradas"` + edição da mensagem original (remover botões)
   - Novo handler `takelist` (`callback_data: takelist:${listIdx}:${HHMM}`):
     - Análogo, mas resolve por lista de `protocolIds` armazenada em sessão (índice numérico → array)
   - Manter `take_:`, `snooze_:`, `skip_:` atuais para o caso individual.

2. Tests:
   - `takeplan.test.js` — fixture multi-plano valida que apenas doses do `treatment_plan_id` correto são registradas, não cross-plano.
   - `takelist.test.js` — idem para lista flat.

**Critério de aceite**:
- Botão "Registrar este plano" no Telegram registra exatamente as doses daquele plano.
- Estoque decrementa correto para todas as doses.
- Mensagem original é editada (botões removidos) após sucesso.

---

### Sprint 1.3 — Backend: dedup keys + `expoPushChannel` payload data ✅

**Status:** CONCLUÍDO (PR #498) ✅

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: edits cirúrgicos com spec clara — adicionar 2 chaves em `notificationDeduplicator` e enriquecer payload Expo com `data.navigation`. Sem decisões arquiteturais.

**Entregas**:

1. Em `server/services/notificationDeduplicator.js`:
   - Aceitar tipos `'dose_reminder_by_plan'` e `'dose_reminder_misc'`.
   - Chaves: `(userId, 'dose_reminder_by_plan', HHMM, planId)` e `(userId, 'dose_reminder_misc', HHMM)`. Janela 5min mantida.

2. Em `server/notifications/channels/expoPushChannel.js`:
   - Adicionar ao payload Expo:
     ```js
     data: {
       navigation: { screen: 'bulk-plan'|'bulk-misc'|'dose-individual', params: { at, planId, misc, protocolIds, treatmentPlanName } },
       notificationLogId: payload.metadata?.notificationLogId ?? null  // populado em N3
     }
     ```
   - Manter `tag: dose-${HHMM}-${suffix}` (cosmético — Expo pode ignorar; documentar).

3. Em `server/notifications/repositories/notificationLogRepository.js`:
   - Aceitar `protocol_ids: uuid[]` em `provider_metadata`. `protocol_id` recebe `null` para grouped (ou primeiro como "lead" — definir uma regra e seguir).
   - Aceitar `treatment_plan_id` populado quando aplicável.

**Critério de aceite**:
- Push Expo enviado contém `data.navigation` corretamente estruturado (validar via inspeção em sandbox).
- Dedup retorna `false` para chave repetida em 5min, `true` para chave nova.

---

### Sprint 1.4 — Mobile: deeplink real em `usePushNotifications` (cold start + foreground) ✅

**Status:** CONCLUÍDO (PRs #498 + #499) ✅

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Justificativa**: Edge cases de cold start (navigationRef não pronto), `getLastNotificationResponseAsync`, integração com `@react-navigation/native`, mapeamento de screens. Stub atual (`console.log`) é gap crítico — implementação errada quebra a UX inteira do redesign.

**Entregas**:

1. Em `apps/mobile/src/navigation/Navigation.jsx`:
   - Exportar `navigationRef` para uso externo (já existe `useRef(null)` linha 29 — apenas exportar).

2. Em `apps/mobile/src/platform/notifications/usePushNotifications.js`:
   - Substituir `console.log` (linhas 57–66) por:
     ```js
     const { screen, params } = navigation || {}
     const targetRoute = SCREEN_TO_ROUTE[screen] ?? ROUTES.TODAY
     if (navigationRef.current?.isReady()) {
       navigationRef.current.navigate(targetRoute, params)
     } else {
       // Aguardar isReady (caso raro)
       const subscription = navigationRef.current?.addListener?.('state', () => {
         navigationRef.current.navigate(targetRoute, params)
         subscription?.()
       })
     }
     ```
   - Tratar **cold start**: no primeiro `useEffect`, chamar `Notifications.getLastNotificationResponseAsync()` e processar resposta como se fosse tap (mesmo path).
   - Mapa `SCREEN_TO_ROUTE`: `bulk-plan` / `bulk-misc` / `dose-individual` → `ROUTES.TODAY` (modal abre por params).

3. Tests:
   - Mock `navigationRef` e `Notifications.getLastNotificationResponseAsync`. Validar navegação correta para cada `screen`.

**Critério de aceite**:
- Tap em push com app em foreground → navega para Today com params.
- App matado, tap em push → cold start abre Today com params (não tela vazia).
- `__DEV__` logs preservados, mas comportamento de produção é **navegar de fato**.

---

### Sprint 1.5 — Mobile: `BulkDoseRegisterModal.jsx` (NOVO) ✅

**Status:** CONCLUÍDO (PR #500) ✅

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Justificativa**: Componente totalmente novo em RN, batch logic com decremento de estoque, dois modos (`plan` / `misc`), checkboxes pré-marcados, edge case de offline (queue local + retry — pode ser follow-up). Reusar lógica do web `LogForm` mas em RN puro (sem react-hook-form).

**Entregas**:

1. Criar `apps/mobile/src/features/dose/components/BulkDoseRegisterModal.jsx`:
   - Props: `{ visible, onClose, mode: 'plan'|'misc', planId?, protocolIds?, scheduledTime }`
   - Carrega protocolos correspondentes via `protocolService` ou hook (`usePlanProtocols(planId)` ou `useProtocolsByIds(protocolIds)`)
   - Lista de checkboxes pré-marcados (todos `true` por default)
   - Header: nome do plano (se `mode='plan'`) ou "Doses agora — HH:MM" (se `mode='misc'`)
   - CTA: `"Registrar X doses"` (count atualiza com unchecks)
   - Submit: chama `medicineLogService.createMany(selectedLogs)` + decremento de estoque (já em `medicineLogService`?)
   - Loading + erro estados

2. Estilos seguindo design tokens (`apps/mobile/src/shared/styles/tokens.js`).

3. Tests:
   - `BulkDoseRegisterModal.test.jsx` — render com fixture de plano, valida bulk submit, valida que unchecking remove do batch.

**Critério de aceite**:
- Modal abre com 4 medicamentos pré-marcados → submit registra 4 logs.
- Unchecking 1 medicamento → submit registra 3.
- Estoque decrementa para todos os submitted (validar via fetch após submit).

---

### Sprint 1.6 — Mobile: estender Inbox (`NotificationItem` + `NotificationInboxScreen` + `useNotificationLog`)

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Edits cirúrgicos com spec exata — estender mapas (`CTA_MAP`, `DEEP_LINK_TARGETS`), adicionar branches em `resolveTitle`, atualizar SELECT no hook, atualizar `buildWasTakenMap`. Cada mudança é tipada e testável independentemente.

**Entregas**:

1. Em `apps/mobile/src/features/notifications/components/NotificationItem.jsx`:
   - Estender `CTA_MAP:18–24`:
     ```js
     dose_reminder_by_plan: { label: 'Registrar plano', action: 'bulk-plan' },
     dose_reminder_misc:    { label: 'Registrar doses', action: 'bulk-misc' },
     ```
   - Em `resolveTitle:26–40`, adicionar branches:
     - `dose_reminder_by_plan` → `notification.treatment_plan_name ?? 'Plano de tratamento'`
     - `dose_reminder_misc` → `'Doses agora'`
   - Footer (linhas 110–119): se `wasTaken` for objeto `{ taken, total }`, renderizar `"X/N tomadas"` com cor proporcional.

2. Em `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx`:
   - `DEEP_LINK_TARGETS:32–37` adicionar `'bulk-plan': ROUTES.TODAY`, `'bulk-misc': ROUTES.TODAY`.
   - `onNavigate` (linha 153) — passar params do log: `{ at: HHMM, planId, protocolIds, treatmentPlanName }` extraídos de `notification.metadata` ou `notification.treatment_plan_id`.
   - `buildWasTakenMap:67–79` — refatorar para grouped:
     ```js
     if (n.notification_type === 'dose_reminder_by_plan' || n.notification_type === 'dose_reminder_misc') {
       const protocolIds = n.provider_metadata?.protocol_ids ?? []
       const taken = protocolIds.filter(pid =>
         doseLogs.some(log => log.protocol_id === pid && new Date(log.taken_at) > new Date(n.sent_at))
       ).length
       map[n.id] = { taken, total: protocolIds.length }
     }
     ```

3. Em `apps/mobile/src/shared/hooks/useNotificationLog.js`:
   - SELECT incluir `treatment_plan_id`, `treatment_plan_name`, `provider_metadata`.

4. Em `packages/core/src/utils/notificationIconMapper.js` (ou local equivalente):
   - Adicionar `dose_reminder_by_plan` (ícone `Package`), `dose_reminder_misc` (ícone `Clock`).

**Critério de aceite**:
- Inbox renderiza notificação grouped com título correto e contagem "X/N tomadas".
- Tap navega para Today + abre BulkDoseRegisterModal com params corretos.

---

### Sprint 1.7 — Web: deeplink Today + service worker tag ⛔ BLOQUEADA

**Status:** BLOQUEADA — push web nunca implementado (sem `sw.js`, sem view `Today`). Adiada para quando push web for desenvolvido (fora do escopo da Wave N1).

> **Análise C1 (2026-04-26):** `apps/web/public/` não tem `sw.js`; App.jsx usa sistema view-based sem React Router; push web não existe. A sprint dependia de infra inexistente. `GlobalDoseModal` e `LogForm` já suportam `type='plan'` — o mecanismo de deeplink pode ser plugado quando push web for implementado.

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini) — quando desbloqueada

**Justificativa**: `LogForm type='plan'` já existe. Apenas conectar URL params → abrir form pré-configurado. SW tag é one-line.

**Entregas**:

1. Em `apps/web/src/features/dashboard/views/Today.jsx` (ou equivalente):
   - Ler `?at=HHMM&plan=${planId}` ou `?at=HHMM&misc=1` da URL via `useSearchParams` ou similar.
   - Se `plan` presente: abrir `LogForm` com `type='plan'` e `treatment_plan_id` pré-selecionado.
   - Se `misc=1`: abrir `LogForm` com `type='bulk'` (estender se necessário) com `protocolIds` pré-marcados (passados via state ou param adicional).

2. Em `apps/web/public/sw.js`:
   - No handler de `push` event, adicionar `tag: payload.tag` ao `showNotification(title, options)`.
   - Garantir que `payload.tag = 'dose-{HHMM}-{plan|misc|protocolId}'` vindo do server.

**Critério de aceite**:
- URL `dosiq://today?at=08:00&plan=abc-123` (ou versão web equivalente) abre LogForm pré-configurado.
- 2 push com tags `dose-08:00-plan-A` e `dose-08:00-plan-B` aparecem como notificações distintas (não substituem).

---

### Sprint 1.8 — Validação manual + DEVFLOW C5

**Agente recomendado**: ⚪ **Humano** (operador)

**Entregas**:

1. **Sandbox bot Telegram**:
   - Cenário A (8 sem plano): valida 1 mensagem consolidada
   - Cenário D (4+3 dois planos): valida 2 mensagens nomeadas
   - Cenário E (4+3+2): valida 3 mensagens
   - Botão "Registrar este plano" registra apenas o plano correto (validar via app web)

2. **Mobile device físico**:
   - Cold start: matar app → enviar push (manual via Expo CLI ou via cron) → tocar → abre `BulkDoseRegisterModal`
   - Foreground: app aberto → push chega → tap banner → abre modal
   - Inbox: registrar 2 das 4 doses do plano → voltar → item exibe "2/4 tomadas"
   - Lock screen iOS: cenário D → confirmar 2 notificações distintas (não substituem)

3. **DEVFLOW C5**:
   - Adicionar R-NNN: "Notificações de doses simultâneas particionam por treatment_plan_id; nunca consolidar tudo em uma só notif"
   - Adicionar AP-NNN: "Não emitir 1 push por protocolo no mesmo minuto (caso real: 8 notifs em 23:39)"
   - Adicionar AP-NNN: "Não colapsar todas as doses simultâneas em uma única notificação consolidada — botão 'registrar todos' fica ambíguo em multimorbidade"
   - Adicionar R-NNN: "Mobile push payload deve incluir `data.navigation = { screen, params }` para deeplink real funcionar"
   - Journal entry em `.agent/memory/journal/2026-W17.jsonl` (ou semana corrente)

4. **Quality gates**:
   - `npm run validate:agent` (10-min kill switch)
   - `npm run lint` antes do commit

**Critério de aceite**:
- Todos os cenários A–I validados em ambos canais.
- Memória DEVFLOW atualizada.
- PR aberto com `gh pr create` aguardando Gemini review.

---

## 5. Tabela Resumo de Alocação

| Sprint | Descrição | Agente | Estimativa | Status |
|--------|-----------|--------|------------|--------|
| **1.1** | Backend: partição + formatters | 🟢 Avançado | ~4h | ✅ PR #496 |
| **1.2** | Backend: callbacks `takeplan`/`takelist` | 🟢 Avançado | ~3h | ✅ PR #496 |
| **1.3** | Backend: dedup + payload Expo | 🟡 Rápido | ~1h | ✅ PR #498 |
| **1.4** | Mobile: deeplink real | 🟢 Avançado | ~3h | ✅ PRs #498 + #499 |
| **1.5** | Mobile: `BulkDoseRegisterModal` | 🟢 Avançado | ~4h | ✅ PR #500 |
| **1.6** | Mobile: estender Inbox | 🟡 Rápido | ~2h | 🔲 Próximo |
| **1.7** | Web: deeplink Today + SW tag | 🟡 Rápido | ~1.5h | 🔲 Pendente |
| **1.8** | Validação + DEVFLOW C5 | ⚪ Humano | ~2h | 🔲 Pendente |

**Total**: ~20.5h trabalho. **5 sprints 🟢 (~14h)** + **3 sprints 🟡 (~4.5h)** + **1 sprint ⚪ (~2h)**.

---

## 6. Distribuição de Tokens (estimativa para gestão de quota)

> Calibração aproximada para planejamento — ajustar conforme telemetria real do time.

- **🟢 Avançado** (Sprint 1.1, 1.2, 1.4, 1.5): cada sprint consome ~30k–60k tokens contexto + saída (lendo arquivos, gerando código, iterando com testes).
- **🟡 Rápido** (Sprint 1.3, 1.6, 1.7): cada sprint consome ~5k–15k tokens.

Wave N1 estimado: **120k–240k tokens em modelos avançados** + **15k–45k em modelos rápidos**.

---

## 7. Critério de Saída

PR #1 pode ser mergeado quando:

- ✅ Todos os 8 sprints concluídos
- ✅ Validação manual cobre cenários A–I
- ✅ Cold start mobile + foreground tap funcionando
- ✅ Inbox cruza grupo via `protocol_ids[]` corretamente
- ✅ Lock screen iOS exibe múltiplas notificações distintas (cenário D)
- ✅ Gemini review aprovado (ou comentários endereçados)
- ✅ `npm run validate:agent` + `npm run lint` passando
- ✅ DEVFLOW C5 registrado (R/AP + journal)
