# Master Plan — Notifications Revamp

> **Status:** EM EXECUÇÃO — Wave N1 5/8 sprints ✅ (N1.1–N1.5 mergeados, N1.6–N1.8 pendentes)
> **Sprint início:** 2026-W17 · **Último merge:** PR #500 (N1.5) — 2026-04-26
> **Idea Plan origem:** [`IDEA_PLAN_NOTIFICATIONS_REVAMP.md`](./IDEA_PLAN_NOTIFICATIONS_REVAMP.md)
> **Exec Specs derivados:**
> - [`EXEC_SPEC_WAVE_N1_GROUPING.md`](./EXEC_SPEC_WAVE_N1_GROUPING.md) — agrupamento por treatment_plan + bulk register mobile · **EM EXECUÇÃO (5/8)**
> - [`EXEC_SPEC_WAVE_N2_QUIET_HOURS.md`](./EXEC_SPEC_WAVE_N2_QUIET_HOURS.md) — quiet hours + digest mode · **Não iniciado**
> - [`EXEC_SPEC_WAVE_N3_COPY_METRICS.md`](./EXEC_SPEC_WAVE_N3_COPY_METRICS.md) — copy variável + métricas de engajamento · **Não iniciado**

---

## 1. Sumário Executivo

O sistema de notificações do Dosiq emite **1 push por protocolo** quando o `time_schedule` bate com o minuto corrente. Para usuários com 6–10 medicamentos simultâneos (perfil real do produto: pacientes cardiovasculares, neurológicos, ICFEr, multimorbidade) isso produz **lock-screens com 8 notificações idênticas** — exatamente o caso documentado em `screenshots/notificacoes-lockscreen.png`.

Este Master Plan estrutura uma reforma em **três waves** que:

1. **Preserva o ganho do produto** (lembrar nada se perde) sem o custo de fadiga.
2. **Aproveita estrutura já modelada** (`treatment_plans`, `LogForm type='plan'`, `TreatmentAccordion`, dispatcher multicanal Telegram + Expo) — não inventa abstração.
3. **Estende a UX para o canal mobile native** (`apps/mobile/`), incluindo deeplink real, Inbox cruzamento por grupo e **bulk register que ainda não existe** nativamente.
4. **Devolve controle ao usuário** com quiet hours e digest mode.
5. **Mede impacto** com tracking de `opened_at` e `action_taken_at` para calibrar copy e cadência.

**Investimento estimado**: ~9 dias de implementação focada, divididos em 3 PRs faseados. **Resultado esperado**: redução de 80–90% no número de notificações por usuário em horários de pico, mantendo (ou melhorando) cobertura de doses lembradas.

---

## 2. Contexto e Diagnóstico

### 2.1 Sintoma observado

Screenshot real às 23:39 — 8 notificações empilhadas: Ansitec, Olmesartana, Espironolactona, SeloZok, Atorvastatina, Ômega 3, Pregabalina, Trimebutina. Todas com a copy idêntica `"💊 Lembrete de nova dose — Está na hora de tomar 1x de [X]. Não deixe para depois!"`.

### 2.2 Causa-raiz técnica

| Componente | Comportamento atual | Limitação |
|------------|---------------------|-----------|
| `server/bot/tasks.js:325–399` (`checkRemindersViaDispatcher`) | Loop `for (protocol of protocols)` chama `dispatcher.dispatch()` 1x por protocolo | Não consolida múltiplas doses no mesmo HHMM |
| `api/notify.js:47–79` (`buildNotificationPayload`) | Template único `dose_reminder` com title/body fixos | Sem variação por hora, criticidade, plano, streak |
| `server/services/notificationDeduplicator.js` | Janela 5min por `(userId, type, protocolId)` | Chave por protocolo — não dedupa por janela coletiva |
| `apps/mobile/.../usePushNotifications.js:53–68` | `addNotificationResponseReceivedListener` só faz `console.log` em DEV | **Tap em push não navega** — gap crítico em produção |
| `user_settings` | Apenas `notification_preference` (canal) | Sem quiet hours, modo, digest_time |
| `notification_log` | Status, channels, message_id | Sem `opened_at`, `action_taken_at` — não medimos engajamento |

### 2.3 Por que isto importa para o posicionamento do produto

Dosiq se posiciona como **gerenciador para tratamentos crônicos** — chatbot IA, ANVISA, titulação, predição de estoque, treatment plans nomeados ("Quarteto Fantástico — ICFEr"). O **público-alvo é exatamente quem mais sofre** com o modelo atual: pacientes com 2–3 planos ativos simultâneos.

Notificação ruim em app de adesão **descredibiliza o produto**: usuário começa a silenciar push, depois ignora todas, depois desinstala. Não é bug cosmético — é falha estrutural na promessa de valor.

### 2.4 Insight estrutural decisivo

A causa-raiz não é falta de feature — é **subutilização** da modelagem existente:

- `protocols.treatment_plan_id` já existe (UUID nullable, sincronizado em `protocolSchema.js:75–77`)
- `treatmentPlanService` (`apps/web/src/features/protocols/services/`)
- `TreatmentAccordion` UI agrupa doses por plano no Dashboard
- `LogForm.jsx:151–160` tem `type='plan'` que faz bulk log com checkboxes pré-marcados
- `DoseZoneList.jsx:146–168` tem `groupByPlan` reutilizável

A notificação pode (e deve) **espelhar essa modelagem** — uma notif por plano nomeado, não uma notif por medicamento individual.

---

## 3. Princípios de Design

| # | Princípio | Implicação prática |
|---|-----------|---------------------|
| P1 | **Preservar identidade do plano em multimorbidade** | Nunca colapsar tudo em uma só notif quando há ≥2 planos com doses simultâneas. 1 notif por plano. |
| P2 | **Degradação graciosa** | Sem plano → consolidada "Suas doses agora". 1 plano → notif do plano. N planos → N notifs nomeadas. 1 dose só → formato atual. |
| P3 | **Botão = escopo claro** | "Registrar este plano" age **apenas** sobre o `treatment_plan_id` da notif. Nunca cross-plano. |
| P4 | **Não repetir copy** | Variação por horário (saudação), streak, status anterior. Seed determinística por (userId, dia) evita repetição em dias consecutivos. |
| P5 | **Controle ao usuário** | Quiet hours e digest mode dão poder ao usuário sem desligar lembretes. |
| P6 | **Mensurar antes de iterar** | `opened_at` e `action_taken_at` em `notification_log` para fechar o loop. |
| P7 | **Não inventar abstração** | Reusar `treatmentPlanService`, `LogForm type='plan'`, `dispatcher`, `notificationDeduplicator`. Evitar paralelos. |
| P8 | **Cobrir o canal mobile** | Mobile app não é segunda-classe: deeplink real, bulk register nativo, settings completos. |

---

## 4. Estratégia em 3 Waves

### Wave N1 — Agrupamento por Treatment Plan + Bulk Mobile

**Objetivo**: Substituir "1 push por protocolo" por **1 push por bloco semântico** (plano com ≥2 doses, OU sobra consolidada de avulsos com ≥2, OU dose individual). Estender mobile com deeplink real e `BulkDoseRegisterModal` nativo.

**Resolve o screenshot**. Não exige migrations. Maior alavanca da reforma.

### Wave N2 — Quiet Hours + Digest Mode

**Objetivo**: Dar controle ao usuário sobre **quando** ser interrompido. Adicionar `quiet_hours_start`, `quiet_hours_end`, `notification_mode` (`realtime` / `digest_morning` / `silent`), `digest_time` em `user_settings`. UI Settings nas duas pontas (web + mobile com `DateTimePicker`).

### Wave N3 — Copy Variável + Métricas

**Objetivo**: Combater fadiga (variação contextual de copy) e **fechar o loop de aprendizado** (tracking de abertura e ação). Refactor de `dispatchNotification.js` para 2-fase (`createPending` → `dispatch` → `markSent`). Pool de copy contextual em `server/bot/notificationCopy.js`.

---

## 5. Resultados Esperados

### 5.1 Métricas quantitativas (KPIs)

| Métrica | Baseline (hoje) | Meta pós-N1 | Meta pós-N3 |
|---------|----------------|-------------|-------------|
| **Notificações por usuário em horário de pico (manhã 08:00)** | 6–10 (1 por med) | 1–3 (1 por plano + sobra) | Idem |
| **Tap-through rate** | Não medimos | ≥40% (estabelecer baseline em N3) | ≥55% |
| **Adesão diária média (% doses tomadas)** | TBD (medir antes de N1) | Manter ou +5pp | +10pp vs. baseline |
| **Push opt-out / silenciamento** | TBD | Reduzir vs. baseline | Reduzir vs. baseline |
| **Tempo médio entre push e ação** | Não medimos | Estabelecer baseline em N3 | Reduzir vs. baseline N3 |

### 5.2 Resultados qualitativos

- **Lock screen limpa** em horário de pico — 1–3 notifs nomeadas em vez de 8 idênticas
- **Identidade do plano preservada** ("Quarteto Fantástico — ICFEr") — usuário reconhece contexto de cada bloco
- **1-tap to bulk register** — modal abre com checkboxes pré-marcados (web já tem; mobile passa a ter)
- **Quiet hours** — usuário noturno deixa de receber push 22:00–07:00 sem perder histórico (vai para Inbox)
- **Digest matinal** opcional — 1 push por dia com agenda completa para quem prefere planejamento ao real-time
- **Copy não repete dia após dia** — saudação contextual, motivação por streak quando aplicável

### 5.3 Resultados não-objetivos (out of scope)

- Criticidade por medicamento (`protocols.criticality`) — backlog Wave N4
- A/B test framework — backlog (depende de N3 estar em produção)
- Auto-tuning de horários típicos de tomada — backlog
- Pré-aviso 5min antes — backlog

---

## 6. Mapa de Arquivos Críticos

### 6.1 Backend / Server

```
api/notify.js                                          (lê + dispatcha cron, edição em N1, N2, N3)
server/bot/tasks.js                                    (formatters + checkReminders, edição N1 N2)
server/bot/callbacks/doseActions.js                    (callbacks Telegram, edição N1 N3)
server/notifications/dispatcher/dispatchNotification.js (refactor 2-fase em N3)
server/notifications/channels/expoPushChannel.js       (enriquecer payload data em N1)
server/notifications/channels/telegramChannel.js       (sem mudança crítica)
server/notifications/repositories/notificationLogRepository.js (estender em N1, N3)
server/services/notificationDeduplicator.js           (chaves novas em N1)
```

### 6.2 Web (apps/web/)

```
apps/web/src/schemas/userSettingsSchema.js             (estender N2)
apps/web/src/features/dashboard/views/Today.jsx        (deeplink params N1)
apps/web/src/features/settings/...                     (UI quiet hours/modo N2)
apps/web/src/features/dashboard/components/...         (insight card N3 opcional)
apps/web/src/App.jsx (router)                          (?notif=id tracker N3)
apps/web/public/sw.js (service worker)                 (tag N1)
```

### 6.3 Mobile (apps/mobile/)

```
apps/mobile/src/platform/notifications/usePushNotifications.js
                                                      (deeplink real N1, opened_at N3)
apps/mobile/src/features/dose/components/BulkDoseRegisterModal.jsx
                                                      (NOVO em N1)
apps/mobile/src/features/dashboard/screens/TodayScreen.jsx
                                                      (abrir modal por params N1)
apps/mobile/src/features/notifications/components/NotificationItem.jsx
                                                      (CTA_MAP + resolveTitle N1)
apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx
                                                      (DEEP_LINK_TARGETS + buildWasTakenMap N1)
apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx
                                                      (3 seções novas N2)
apps/mobile/src/shared/hooks/useNotificationLog.js    (incluir treatment_plan_* N1)
apps/mobile/src/navigation/Navigation.jsx              (expor navigationRef N1)
```

### 6.4 Migrations Supabase

```
N2: ALTER user_settings ADD quiet_hours_start TIME, quiet_hours_end TIME,
                            notification_mode TEXT, digest_time TIME
N3: ALTER notification_log ADD opened_at TIMESTAMPTZ, action_taken_at TIMESTAMPTZ,
                                action_type TEXT
```

---

## 7. Convenções DEVFLOW Esperadas

Cada wave gera registros canônicos em `.agent/memory/`:

| Tipo | Quando | Conteúdo |
|------|--------|----------|
| **R-NNN (Rule)** | Após N1 | "Notificações de doses simultâneas particionam por `treatment_plan_id`. NÃO consolidar tudo em uma só notif" |
| **AP-NNN (Anti-Pattern)** | Após N1 | "Não emitir 1 push por protocolo no mesmo minuto (caso real: 8 notifs em 23:39, screenshot)" |
| **AP-NNN (extra)** | Após N1 | "Não colapsar todas as doses simultâneas em 1 só notif consolidada — botão 'registrar todos' fica ambíguo em multimorbidade" |
| **R-NNN** | Após N1 | "Mobile push payload deve incluir `data.navigation = { screen, params }` para deeplink funcionar via `addNotificationResponseReceivedListener`" |
| **ADR-NNN** | Após N2 | "Política de quiet hours e modos de notificação (`realtime`/`digest_morning`/`silent`) — campos em `user_settings`" |
| **R-NNN** | Após N3 | "Tracking de notificação requer `notificationLogId` no payload do push, gerado em `createPending` antes do dispatch" |
| **Journal entries** | Após cada wave | `.agent/memory/journal/2026-W17.jsonl` (ou seguinte) |

---

## 8. Risco e Mitigação

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Telegram 4096 chars excedido com plano de 15+ meds | Baixa | Truncar para top-10 + "_… e mais N_" |
| Expo SDK ignorar `tag` cosmético | Baixa | Aceitar; pior caso = duplicação curta. Documentar. Considerar Web Push direto futuro. |
| `navigationRef` não pronto no cold start | Média | `Notifications.getLastNotificationResponseAsync()` em `useEffect` que aguarda `navigationRef.isReady()` |
| Bulk register mobile aumenta escopo de N1 | Média | Bem isolado em `BulkDoseRegisterModal`. Sem ele, deeplink leva a Today vazio (sub-ótimo mas funcional). Não cortar — é peça-chave. |
| Migration de `notification_log.opened_at` em produção | Baixa | Coluna nullable, default seguro, sem rollback necessário |
| Refactor de `dispatchNotification` 2-fase quebra fire-and-forget existente | Média | Cobertura por testes; manter fallback de log pós-envio se `createPending` falhar |
| Schema `userSettingsSchema` duplicado web/mobile | Baixa | Idealmente consolidar em `packages/core/`; aceitar duplicação se mobile não importar de core ainda |
| Multimorbidade em horário de pico gera spam de 4–5 push em sequência (Wave N1) | Média | Aceitar — ainda é melhor que 8 idênticas. Wave N2 (digest) resolve para quem opt-in. |

---

## 9. Cronograma de Execução

| Wave | Sprints internos | Estimativa | PR |
|------|-----------------|------------|----|
| **N1** — Agrupamento + Bulk Mobile | 8 sprints (`1.1` a `1.8`) | ~3 dias úteis | PR #1 |
| **N2** — Quiet Hours + Digest | 7 sprints (`2.1` a `2.7`) | ~3 dias úteis | PR #2 |
| **N3** — Copy + Métricas | 9 sprints (`3.1` a `3.9`) | ~3 dias úteis | PR #3 |

Detalhamento sprint-a-sprint, com **alocação de agente coder por sprint** (avançado vs. rápido) para gestão de tokens, está nos Exec Specs por wave.

---

## 10. Critério de Sucesso Global

O projeto é considerado entregue quando:

1. ✅ Cenários A–I da tabela de agrupamento (em `IDEA_PLAN_NOTIFICATIONS_REVAMP.md` §Wave N1) passam em validação manual no sandbox bot **e** em device físico mobile.
2. ✅ Tap em push mobile abre `BulkDoseRegisterModal` com checkboxes pré-marcados (cold start e foreground).
3. ✅ Inbox mobile exibe "X/N tomadas" para grouped notifications.
4. ✅ Quiet hours configurado em Settings suprime push em janela definida (validado por device físico durante 24h).
5. ✅ `notification_log.opened_at` é populado quando usuário toca em push (web e mobile).
6. ✅ Copy de "Bom dia" não é idêntica em dois dias consecutivos para o mesmo usuário (seed determinístico válido).
7. ✅ `npm run validate:agent` passa antes de cada PR. `npm run lint` passa antes de commit.
8. ✅ Memória DEVFLOW atualizada com R/AP/ADR após cada wave (3 entries de journal mínimo).
