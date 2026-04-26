# Exec Spec — Wave N3: Copy Variável + Métricas de Engajamento

> **Status:** PRONTO PARA EXECUÇÃO (após N1 mergeado) · **independente de N2**
> **Master Plan:** [`MASTER_PLAN_NOTIFICATIONS_REVAMP.md`](./MASTER_PLAN_NOTIFICATIONS_REVAMP.md)
> **Idea Plan:** [`IDEA_PLAN_NOTIFICATIONS_REVAMP.md`](./IDEA_PLAN_NOTIFICATIONS_REVAMP.md) — §Wave N3
> **Pré-requisito:** Wave N1 mergeado (PR #1) · N2 **não é pré-requisito**
> **PR alvo:** PR #3 da reforma
> **Estimativa:** ~3.5 dias úteis · 9 sprints
>
> **Nota de design (2026-04-26):** N3 absorveu o formatter enriquecido do digest (`formatDailyDigestMessage`
> com agrupamento por bloco temporal + copy variável) que estava em N2 Sprint 2.3.
> Separação: N2 = *quando* enviar (gates), N3 = *o que* enviar (conteúdo + copy).
> Sprint 3.4 expandido para incluir criação do formatter enriquecido + copy variável.

---

## 1. Objetivo

(a) **Combater fadiga**: substituir copy hard-coded por pool contextual (saudação por horário, motivação por streak, anti-repetição com seed determinística por dia).
(b) **Fechar o loop de aprendizado**: tracking de `opened_at` e `action_taken_at` em `notification_log` para medir engajamento e calibrar futuras iterações.

---

## 2. Pré-requisitos

| Item | Estado |
|------|--------|
| Wave N1 mergeada | ⏳ — único pré-requisito |
| Wave N2 mergeada | ✅ não necessário — N2 e N3 são independentes após N1 |
| `dispatchNotification.js` fire-and-forget | ✅ — precisa **refactor para 2-fase** (`createPending` → `dispatch` → `markSent`) |
| `notification_log` tabela | ✅ — precisa **migration** para adicionar 3 colunas |
| Streak service (`adherenceService.getCurrentStreak`) | ✅ |
| Mobile `usePushNotifications` deeplink | ✅ (entregue na N1) |

---

## 3. Convenção de Alocação de Agente

(Ver §3 de [`EXEC_SPEC_WAVE_N1_GROUPING.md`](./EXEC_SPEC_WAVE_N1_GROUPING.md).)

---

## 4. Sprints

### Sprint 3.1 — Migration `notification_log` (3 colunas) + Zod sync

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Operação mecânica.

**Entregas**:

1. Migration:
   ```sql
   ALTER TABLE notification_log
     ADD COLUMN opened_at TIMESTAMPTZ,
     ADD COLUMN action_taken_at TIMESTAMPTZ,
     ADD COLUMN action_type TEXT;  -- 'opened', 'take_all', 'take_plan', 'take_misc', 'snooze', 'skip'
   ```

2. Atualizar Zod schema do log (`packages/core/.../notificationLogSchema.js`).

3. Atualizar repository `getByUserId` para retornar os campos novos.

**Critério de aceite**:
- Migration aplica.
- Hooks de inbox (`useNotificationLog`) trazem os campos novos sem regressão.

---

### Sprint 3.2 — Refactor `dispatchNotification.js` para 2-fase

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Justificativa**: Refactor delicado em código crítico (dispatcher central, ADR-029). Hoje fire-and-forget pós-envio (linhas 78–129); novo fluxo precisa criar log **antes** do dispatch para que `notificationLogId` esteja no payload (necessário para tracking). Erros silenciosos quebram TODAS as notificações.

**Entregas**:

1. Em `server/notifications/dispatcher/dispatchNotification.js`:
   - Substituir IIFE pós-envio por sequência:
     ```js
     // Fase 1: criar log pending ANTES do dispatch
     const logEntry = await notificationLogRepository.create({
       user_id: userId,
       protocol_id: protocolId,
       notification_type: kind,
       title: payload.title,
       body: payload.body,
       status: 'pending',
       channels: [],
     })

     // Fase 2: enriquecer payload com notificationLogId para deeplink/tracking
     payload.metadata.notificationLogId = logEntry.id

     // Fase 3: dispatch nos canais
     const results = await Promise.allSettled(...)

     // Fase 4: markSent — atualizar log com resultado consolidado
     await notificationLogRepository.update(logEntry.id, {
       status: overallStatus,
       channels,
       telegram_message_id,
       sent_at: new Date(),
       mensagem_erro: firstError,
     })
     ```
   - **Fallback**: se `create` falhar, ainda tenta dispatch (não bloquear push por falha de log) e tenta `create` retroativo no estilo antigo. Documentar.
   - Manter `Promise.allSettled` por canal.

2. Tests:
   - Unit: simular falha no `create` → dispatch ainda acontece.
   - Unit: simular sucesso → log tem `id` e payload tem `notificationLogId`.

**Critério de aceite**:
- Logs criados em estado `pending` antes do dispatch, atualizados depois.
- `notificationLogId` aparece em payload Telegram (`callback_data` ou texto) e Expo (`data.notificationLogId`).
- Backward-compat: se canais falham, log ainda atualiza com `status='falhou'`.

---

### Sprint 3.3 — `notificationCopy.js` library (pools + seed determinística)

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Justificativa**: Lógica de variação com anti-repetição (seed por (userId, dia)), múltiplos pools, edge cases (streak 0, streak quebrado). Requer testes determinísticos não-triviais.

**Entregas**:

1. Criar `server/bot/notificationCopy.js`:
   ```js
   const GREETINGS = {
     morning: ['☀️ Bom dia!', 'Comece bem o dia', 'Hora dos remédios da manhã'],
     lunch:   ['🍽️ Hora do almoço', 'Pausa para os medicamentos do almoço'],
     afternoon: ['☕ Boa tarde', 'Hora dos remédios da tarde'],
     evening: ['🌆 Hora dos remédios da noite', 'Antes de relaxar'],
     night:   ['🌙 Última dose do dia', 'Antes de dormir'],
   }

   export function pickGreeting(hour, userId, dateStr) {
     const block = blockOf(hour)
     const seed = hash(`${userId}-${dateStr}`)
     const pool = GREETINGS[block]
     return pool[seed % pool.length]
   }

   export function pickStreakLine({ streak }) {
     if (streak >= 30) return `🎯 ${streak} dias seguidos — você está mandando bem`
     if (streak >= 7)  return `🔥 ${streak}º dia em sequência`
     return null  // sem línea de streak
   }

   export function pickStreakBrokenLine({ previousStreak }) {
     if (previousStreak >= 7) return `💔 Sua sequência de ${previousStreak} dias foi quebrada — tudo bem, recomeça hoje`
     return null
   }
   ```

2. Helper `blockOf(hour)`: 5–10=morning, 11–13=lunch, 14–17=afternoon, 18–22=evening, 23–04=night.

3. Tests:
   - Mesma seed → mesma escolha (determinismo).
   - Seeds diferentes (dias consecutivos) → escolhas diferentes (anti-repetição).
   - `pickStreakLine` retorna `null` para streak < 7.

**Critério de aceite**:
- Determinismo validado: 100 chamadas com mesmo seed retornam mesma string.
- Distribuição razoável entre pools ao longo de 30 seeds (sem viés extremo).

---

### Sprint 3.4 — Formatter enriquecido do digest + copy variável em todos os formatters

**Agente recomendado**: 🟢 **Avançado** (Sonnet/Pro/Codex)

**Justificativa**: Sprint expandido — absorveu o formatter enriquecido que era N2 Sprint 2.3 (🟢).
Dois entregáveis: (a) criar `formatDailyDigestMessage` com agrupamento por bloco temporal + plano,
(b) substituir copy hard-coded em todos os formatters existentes via picks de `notificationCopy.js`.
Ambos tocam `tasks.js` profundamente e têm edge cases não-triviais de MarkdownV2.

**Entregas**:

1. **Criar `formatDailyDigestMessage(blocksByTime, pickGreeting, pickStreakLine)`** em `server/bot/tasks.js`:
   - Agrupar `dosesToday[]` por bloco temporal (manhã ≤10:59, almoço 11–13:59, tarde 14–17:59, noite 18–22:59, madrugada 23–04:59)
   - Dentro de cada bloco, agrupar por plano (reutilizar `partitionDoses` de Wave N1)
   - Output com greeting variável no cabeçalho e streak line opcional:
     ```
     ☀️ *Bom dia!*  ← pickGreeting(hour, userId, today)
     🔥 *7º dia em sequência*  ← pickStreakLine (opcional, omitir se streak < 7)

     *Sua agenda de hoje*

     🌅 *Manhã*
       08:00 — Quarteto Fantástico (4 medicamentos)
       09:00 — Trimebutina

     🍽️ *Almoço*
       12:00 — Olmesartana

     🌆 *Noite*
       20:00 — Ansiolíticos TAG (2 medicamentos)
     ```
   - Em `runDailyDigest`: substituir o formato simples de N2 Sprint 2.3 por este formatter.
     (Se N2 não estiver mergeado ainda, `runDailyDigest` ainda não existe — criar junto.)

2. **Substituir copy hard-coded nos formatters existentes de N1** em `api/notify.js` + `server/bot/tasks.js`:
   - `buildNotificationPayload`: title hard-coded → `pickGreeting(hour, userId, today) + contexto`.
   - `formatDoseGroupedByPlanMessage`: incluir streak line opcional via `pickStreakLine`.
   - Soft reminder + daily digest: incluir greeting variável.

3. **Tests**:
   - `formatDailyDigestMessage.test.js`: fixtures de agenda completa, esparsa, sem doses, com streak.
   - Snapshot tests com seed fixa para output determinístico dos outros formatters.

**Critério de aceite**:
- Digest agrupa corretamente por bloco e plano com copy variável.
- Renderização válida em MarkdownV2 (sem caracteres não-escapados).
- Output dos formatters muda entre dias para mesmo user (seed diferente por dia).
- Se N2 já estiver mergeado: `runDailyDigest` usa `formatDailyDigestMessage` enriquecido.
- Se N2 não estiver mergeado: formatter existe em código mas ainda não é acionado (sem efeito colateral).

> **Compatibilidade com N2**: Se N2 for mergeado depois de N3, a única ação necessária é confirmar
> que `runDailyDigest` chama `formatDailyDigestMessage` (já garantido por este sprint). Sem retrabalho.

---

### Sprint 3.5 — Endpoint de tracking `opened_at`

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: CRUD simples. Decisão única: criar endpoint dedicado vs. Supabase REST direto. Recomendado: **Supabase REST direto** com RLS (sem custar slot da Vercel Hobby budget — atual 6/12).

**Entregas**:

1. Adicionar policy RLS em `notification_log`:
   ```sql
   CREATE POLICY "users can update opened_at on own logs"
     ON notification_log FOR UPDATE
     USING (auth.uid() = user_id)
     WITH CHECK (auth.uid() = user_id);
   ```
   - **Restringir colunas mutáveis** se Supabase suportar (caso contrário, validação client-side é aceitável dado RLS já restringe a `user_id` próprio).

2. Helper compartilhado `markNotificationOpened(supabase, notificationLogId)`:
   - Em `packages/core/` ou `apps/web/src/utils/` + `apps/mobile/src/shared/utils/`
   - Idempotente: `UPDATE notification_log SET opened_at = now() WHERE id = $1 AND opened_at IS NULL`

**Critério de aceite**:
- RLS bloqueia tentativa de update em log de outro usuário (validar com user-2 token).
- Helper é idempotente (não sobrescreve `opened_at` já populado).

---

### Sprint 3.6 — Web router: `?notif=id` marker

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Edit pontual no `App.jsx` ou router; usar helper já criado em Sprint 3.5.

**Entregas**:

1. Em `apps/web/src/App.jsx` (ou router principal):
   - `useEffect` lê `?notif=${id}` da URL ao montar.
   - Se presente, chama `markNotificationOpened(supabase, id)`.
   - Limpa o param da URL via `history.replaceState` para não duplicar em F5.

2. No backend, adicionar `?notif=${notificationLogId}` ao deeplink web (em `buildNotificationPayload`).

**Critério de aceite**:
- Tap em push do PWA → URL contém `?notif=id` → `opened_at` é populado.

---

### Sprint 3.7 — Mobile: `opened_at` em `usePushNotifications` + Inbox

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Edit pontual; helper compartilhado já existe (Sprint 3.5).

**Entregas**:

1. Em `apps/mobile/src/platform/notifications/usePushNotifications.js` (handler de tap):
   - Antes de navegar, chamar `markNotificationOpened(supabase, data.notificationLogId)` se presente.

2. Em `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx`:
   - Ao tocar item da Inbox: marcar `opened_at` se ainda nulo (separar de `read_at` que `markAllRead` já faz).
   - Esclarecer semântica: `read_at` = visualizou na Inbox; `opened_at` = clicou para tomar ação (push tap ou Inbox tap com CTA).

**Critério de aceite**:
- Tap em push mobile popula `opened_at`.
- Tap em item da Inbox com CTA popula `opened_at` (mas não tap em digest sem CTA).

---

### Sprint 3.8 — Telegram callbacks: `action_taken_at`

**Agente recomendado**: 🟡 **Rápido** (Haiku/Fast/Mini)

**Justificativa**: Edit pontual em handlers existentes (Wave N1).

**Entregas**:

1. Em `server/bot/callbacks/doseActions.js` (handlers `take_`, `takeplan`, `takelist`, `snooze_`, `skip_`):
   - Após sucesso: `UPDATE notification_log SET action_taken_at = now(), action_type = 'take_plan' WHERE id = $1` (ou outro `action_type` conforme handler).

**Critério de aceite**:
- Botão "Registrar este plano" → log marca `action_taken_at` + `action_type='take_plan'`.

---

### Sprint 3.9 — Validação manual + DEVFLOW C5 (+ Insight card opcional)

**Agente recomendado**: ⚪ **Humano** (validação) + 🟡 **Rápido** (insight card opcional)

**Entregas**:

1. **Validação manual**:
   - Tap em push web → URL contém `?notif=id` → DB tem `opened_at`.
   - Tap em push mobile → DB tem `opened_at` para o log correspondente.
   - Botão Telegram "Registrar este plano" → DB tem `action_taken_at` + `action_type='take_plan'`.
   - Greeting muda entre 2 dias consecutivos para mesmo user.

2. **Insight card** (🟡 opcional):
   - `apps/web/src/features/dashboard/components/NotificationStatsCard.jsx` (novo) — query `notification_log` últimos 30 dias, calcula `% de logs com opened_at OR action_taken_at`, renderiza "Sua taxa de resposta a notificações: X%".

3. **DEVFLOW C5**:
   - R-NNN: "Tracking de notificação requer `notificationLogId` no payload, gerado em `createPending` antes do dispatch (refactor 2-fase em `dispatchNotification`)"
   - R-NNN: "Copy de notificação usa seed determinística por (userId, dia) para evitar repetição em dias consecutivos"
   - Journal entry

4. **Quality gates**:
   - `npm run validate:agent`
   - `npm run lint`

---

## 5. Tabela Resumo de Alocação

| Sprint | Descrição | Agente | Estimativa |
|--------|-----------|--------|------------|
| **3.1** | Migration `notification_log` + Zod | 🟡 Rápido | ~1h |
| **3.2** | Refactor dispatcher 2-fase | 🟢 Avançado | ~4h |
| **3.3** | `notificationCopy.js` library | 🟢 Avançado | ~3h |
| **3.4** | Formatter enriquecido digest + copy variável *(absorvido de N2)* | 🟢 Avançado | ~3.5h |
| **3.5** | Endpoint tracking + RLS | 🟡 Rápido | ~1.5h |
| **3.6** | Web router `?notif=id` | 🟡 Rápido | ~1h |
| **3.7** | Mobile `opened_at` | 🟡 Rápido | ~1h |
| **3.8** | Telegram `action_taken_at` | 🟡 Rápido | ~0.5h |
| **3.9** | Validação + DEVFLOW (+insight card opcional) | ⚪ Humano + 🟡 | ~2h (+1h opcional) |

**Total**: ~17.5h trabalho *(+2h absorvidas de N2)*. **3 sprints 🟢 (~10.5h)** + **5 sprints 🟡 (~5h)** + **1 sprint ⚪ (~2h)**.

---

## 6. Distribuição de Tokens (estimativa)

- **🟢 Avançado** (3.2, 3.3): ~30k–60k tokens cada.
- **🟡 Rápido** (3.1, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9 opcional): ~5k–15k tokens cada.

Wave N3 estimado: **60k–120k tokens em modelos avançados** + **35k–105k em modelos rápidos**.

> **Observação**: Wave N3 é a mais "leve" em modelos avançados (apenas 2 sprints), mas a mais densa em sprints 🟡 (6 sprints). Excelente para usar quota residual de modelos rápidos.

---

## 7. Critério de Saída

PR #3 pode ser mergeado quando:

- ✅ Todos os 9 sprints concluídos
- ✅ Migration `notification_log` aplicada
- ✅ Refactor 2-fase do dispatcher validado em sandbox (logs `pending` → `enviada`)
- ✅ `opened_at` populado para taps reais (web + mobile)
- ✅ `action_taken_at` populado para callbacks Telegram
- ✅ Greeting determinístico (mesma seed = mesma string) e variável entre dias
- ✅ Gemini review aprovado
- ✅ `npm run validate:agent` + `npm run lint` passando
- ✅ DEVFLOW C5 (2 novas R-NNN + journal)
- ✅ (Opcional) Insight card "Taxa de resposta" no Dashboard

---

## 8. Síntese da Reforma — Saldo Total

| Wave | 🟢 Sprints | 🟡 Sprints | ⚪ Sprints | Tokens 🟢 | Tokens 🟡 |
|------|-----------|-----------|-----------|-----------|-----------|
| N1 | 4 (~14h) | 3 (~4.5h) | 1 (~2h) | 120k–240k | 15k–45k |
| N2 | 1 (~3h) ↓ | 5 (~7.5h) ↑ | 1 (~2h) | 25k–50k ↓ | 25k–75k ↑ |
| N3 | 3 (~10.5h) ↑ | 5 (~5h) ↓ | 1 (~2h) | 90k–180k ↑ | 25k–75k ↓ |
| **Total** | **8 (~27.5h)** | **13 (~17h)** | **3 (~6h)** | **235k–470k 🟢** | **65k–195k 🟡** |

*(Totais globais estáveis — trabalho apenas redistribuído de N2.3 para N3.4)*

**Trabalho útil**: ~50.5h de implementação + validação distribuídas em 3 PRs — igual ao original.

**Recomendação de orçamento (revisada 2026-04-26)**:
- N1: quota generosa de 🟢 (sprints 1.1, 1.2, 1.4, 1.5 são pilares)
- N2: agora majoritariamente 🟡 — ótima wave para usar quota residual de modelos rápidos
- N3: mais pesada em 🟢 (3 sprints avançados: 3.2 dispatcher, 3.3 copy library, 3.4 formatter digest)
- N2 e N3 podem ser executadas **em paralelo por equipes diferentes** após N1 mergeado
