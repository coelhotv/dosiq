# Master Plan — Notifications Revamp

> **Status:** PROGREDINDO — Wave N1 7/8 ✅ (N1.7 PWA desenvolvido, aguarda merge) + Wave N2 COMPLETA (8/8) ✅ + N3 Planejado
> **Sprint início:** 2026-W17 · **Último merge:** commit `02802bfa` (Wave N2 RLS fix) — 2026-04-28
> **Idea Plan origem:** [`IDEA_PLAN_NOTIFICATIONS_REVAMP.md`](./IDEA_PLAN_NOTIFICATIONS_REVAMP.md)
> **Exec Specs derivados:**
> - [`EXEC_SPEC_WAVE_N1_GROUPING.md`](./EXEC_SPEC_WAVE_N1_GROUPING.md) — agrupamento por treatment_plan + bulk register mobile · **✅ ENTREGUE (PR #497 + #498 + #501 + #505)**
> - [`EXEC_SPEC_WAVE_N2_QUIET_HOURS.md`](./EXEC_SPEC_WAVE_N2_QUIET_HOURS.md) — quiet hours + digest mode + redesign da experiência nativa de notificações · **✅ ENTREGUE (PR #506 + #507)**
> - [`EXEC_SPEC_WAVE_N3_COPY_METRICS.md`](./EXEC_SPEC_WAVE_N3_COPY_METRICS.md) — copy variável + métricas de engajamento · **Planejado (roadmap Wave 6)**

---

## 1. Sumário Executivo

O sistema de notificações do Dosiq emite **1 push por protocolo** quando o `time_schedule` bate com o minuto corrente. Para usuários com 6–10 medicamentos simultâneos (perfil real do produto: pacientes cardiovasculares, neurológicos, ICFEr, multimorbidade) isso produz **lock-screens com 8 notificações idênticas** — exatamente o caso documentado em `screenshots/notificacoes-lockscreen.png`.

Este Master Plan estrutura uma reforma em **três waves** que:

1. **Preserva o ganho do produto** (lembrar nada se perde) sem o custo de fadiga.
2. **Aproveita estrutura já modelada** (`treatment_plans`, `LogForm type='plan'`, `TreatmentAccordion`, dispatcher multicanal Telegram + Expo + Web Push) — não inventa abstração.
3. **Estende a UX para o canal mobile native** (`apps/mobile/`), incluindo deeplink real, Inbox cruzamento por grupo e **bulk register que ainda não existe** nativamente.
4. **Devolve controle ao usuário** com quiet hours, digest mode e preferências de canais App/Telegram/Web (PWA) mais claras.
5. **Mede impacto** com tracking de `opened_at` e `action_taken_at` para calibrar copy e cadência.
6. **Organiza a experiência nativa** em uma jornada coerente: Perfil → Avisos → Preferências → Telegram.

**Investimento estimado**: ~10 dias de implementação focada, divididos em 3 PRs faseados. **Resultado esperado**: redução de 80–90% no número de notificações por usuário em horários de pico, mantendo (ou melhorando) cobertura de doses lembradas e tornando a experiência de notificações nativa mais compreensível.

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
| `user_settings` | Apenas `notification_preference` (canal legado) | Sem quiet hours, modo, digest_time e flags explícitas para App/Telegram/Web (PWA) |
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
| P5 | **Controle ao usuário** | Quiet hours, digest mode e canais configuráveis dão poder ao usuário sem desligar todos os lembretes. |
| P6 | **Mensurar antes de iterar** | `opened_at` e `action_taken_at` em `notification_log` para fechar o loop. |
| P7 | **Não inventar abstração** | Reusar `treatmentPlanService`, `LogForm type='plan'`, `dispatcher`, `notificationDeduplicator`. Evitar paralelos. |
| P8 | **Cobrir o canal mobile** | Mobile app não é segunda-classe: deeplink real, bulk register nativo, settings completos. |
| P9 | **Uma jornada, não telas soltas** | No app nativo, notificações entram por Perfil → Avisos → Preferências → Telegram. Evitar cards paralelos e duplicados. |

---

## 4. Estratégia em 3 Waves

### Wave N1 — Agrupamento por Treatment Plan + Bulk Mobile

**Objetivo**: Substituir "1 push por protocolo" por **1 push por bloco semântico** (plano com ≥2 doses, OU sobra consolidada de avulsos com ≥2, OU dose individual). Estender mobile com deeplink real e `BulkDoseRegisterModal` nativo.

**Resolve o screenshot**. Não exige migrations. Maior alavanca da reforma.

### Wave N2 — Quiet Hours + Redesign da Experiência Nativa

**Objetivo**: Dar controle ao usuário sobre **quando** e **onde** ser interrompido, e reorganizar a experiência nativa de notificações em quatro níveis: Perfil → Avisos → Preferências → Telegram. Adicionar `quiet_hours_start`, `quiet_hours_end`, `notification_mode` (`realtime` / `digest_morning` / `silent`), `digest_time` e flags explícitas de canais App/Telegram/Web (PWA) em `user_settings`. UI Settings nas duas pontas, com redesign completo no app nativo e switch funcional de Web Push na web. Digest matinal com formato simples funcional — enriquecimento estético pelo formatter de N3.

**Dependência**: apenas N1. Independente de N3. Pode executar em paralelo com N3.

### Wave N3 — Copy Variável + Métricas + Formatter Digest

**Objetivo**: Combater fadiga (variação contextual de copy + formatter enriquecido do digest agrupado por bloco temporal) e **fechar o loop de aprendizado** (tracking de abertura e ação). Refactor de `dispatchNotification.js` para 2-fase (`createPending` → `dispatch` → `markSent`). Pool de copy contextual em `server/bot/notificationCopy.js`.

**Dependência**: apenas N1. Independente de N2. Pode executar em paralelo com N2.

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
- **Canal Web (PWA) configurável** — usuário pode ativar/desativar push no navegador sem depender do enum legado de preferência
- **Jornada nativa clara** — Perfil concentra a entrada, Avisos concentra mensagens e ações, Preferências concentra canais/cadência, Telegram vira fluxo dedicado
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
apps/web/src/features/settings/...                     (UI quiet hours/modo/canal Web PWA N2)
apps/web/src/shared/services/webpushService.js         (subscribe/register usado por N1.7 e settings N2)
apps/web/src/features/dashboard/components/...         (insight card N3 opcional)
apps/web/src/App.jsx                                   (?notif=id tracker N3; onOpenDoseModal wiring ✅ N1.8)
apps/web/src/shared/hooks/useNotificationLog.js        (enrichWithDoses relacional ✅ N1.8)
apps/web/src/features/notifications/components/
  NotificationCard.jsx                                 (doses rendering + onOpenDoseModal ✅ N1.8)
  NotificationList.jsx                                 (prop chain onOpenDoseModal ✅ N1.8)
apps/web/src/views/redesign/NotificationInbox.jsx      (prop chain onOpenDoseModal ✅ N1.8)
apps/web/src/shared/components/ui/GlobalDoseModal.jsx  (initialValues prop ✅ N1.8)
apps/web/public/sw.js (service worker)                 (tag N1 — aguarda push web)
```

### 6.3 Mobile (apps/mobile/)

```
apps/mobile/src/platform/notifications/usePushNotifications.js
                                                      (deeplink real N1 ✅; screen key fix N1.8 ✅; opened_at N3)
apps/mobile/src/features/dose/components/BulkDoseRegisterModal.jsx
                                                      (NOVO em N1.5 ✅; scheduledTime→usePlanProtocols N1.8 ✅)
apps/mobile/src/features/dose/hooks/usePlanProtocols.js
                                                      (filtro por janela ±2h N1.8 ✅)
apps/mobile/src/features/dashboard/screens/TodayScreen.jsx
                                                      (abrir modal por params N1 ✅; dose-individual deeplink N1.8 ✅)
apps/mobile/src/features/notifications/components/NotificationItem.jsx
                                                      (CTA_MAP + resolveTitle + doses rendering N1.6+N1.8 ✅)
apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx
                                                      (DEEP_LINK_TARGETS + buildWasTakenMap + params fix N1.6+N1.8 ✅)
apps/mobile/src/shared/hooks/useNotificationLog.js    (enrichWithDoses relacional N1.8 ✅)
apps/mobile/src/navigation/Navigation.jsx              (expor navigationRef N1 ✅)
apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx
                                                      (redesign Preferências + canais + quiet hours/digest N2)
apps/mobile/src/features/profile/screens/ProfileScreen.jsx
                                                      (hub Perfil com entrada única "Notificações" N2)
apps/mobile/src/features/profile/screens/TelegramLinkScreen.jsx
                                                      (fluxo dedicado Telegram redesenhado N2)
```

### 6.4 Migrations Supabase

```
N2: ALTER user_settings ADD quiet_hours_start TIME, quiet_hours_end TIME,
                            notification_mode TEXT, digest_time TIME,
                            channel_mobile_push_enabled BOOLEAN,
                            channel_web_push_enabled BOOLEAN,
                            channel_telegram_enabled BOOLEAN
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
| **ADR-NNN** | Após N2 | "Política de quiet hours, modos de notificação (`realtime`/`digest_morning`/`silent`) e canais App/Web/Telegram — campos em `user_settings`" |
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
| `web_push` inferido só por subscription ativa | Média | N2 adiciona `channel_web_push_enabled`; resolver deve exigir flag ativa + device `provider='webpush'` ativo. |
| Multimorbidade em horário de pico gera spam de 4–5 push em sequência (Wave N1) | Média | Aceitar — ainda é melhor que 8 idênticas. Wave N2 (digest) resolve para quem opt-in. |

---

## 9. Cronograma de Execução

| Wave | Sprints internos | Status | PR | Obs |
|------|-----------------|--------|----|-----------| 
| **N1** — Agrupamento + Bulk Mobile | 8 sprints (`1.1` a `1.8`) | 7/8 ✅ (N1.7 pendente) | PR #497, #498, #501, #505 | N1.7 (PWA) desenvolvido, aguarda merge |
| **N2** — Quiet Hours + Native UX Redesign | 8 sprints (`2.1` a `2.8`) | ✅ COMPLETO | PR #506, #507 | Entregue 2026-04-28 |
| **N3** — Copy + Métricas + Formatter Digest | 9 sprints (`3.1` a `3.9`) | 📋 Planejado | — | Pode iniciar pós-N1.7 |

### Resumo N1 (2026-W16 a W17)
- Agrupamento por `treatment_plan_id` ✅ (1.1-1.6)
- Bulk register mobile (BulkDoseRegisterModal) ✅ (1.5)
- Deeplink mobile funcional ✅ (1.4-1.8)
- NotificationItem + NotificationInbox redesenhados ✅ (1.6-1.8)
- `enrichWithDoses` + relacional dosages ✅ (1.8)
- **N1.7 — PWA Web Push**: Desenvolvido ✅ | Merge pendente 🔄

### Resumo N2 (2026-W17)
- Quiet hours com cross-midnight support ✅
- Modos de notificação: realtime / digest_morning / silent ✅
- Flags de canal explícitos: channel_mobile_push_enabled / channel_web_push_enabled / channel_telegram_enabled ✅
- Redesign UX nativa: ProfileScreen hub + TelegramLinkScreen + NotificationPreferencesScreen ✅
- RLS RPC para upsert device token (modelo "último usuário sobrescreve") ✅
- Settings web extensão para quiet hours e modos ✅
- `notificationGate.js` com `shouldSendNow()` + `isInQuietHours()` ✅
- `runDailyDigestViaDispatcher` com N+1 fix (bulk-fetch) ✅

> **N2 e N3 são independentes** — N3 pode executar em paralelo com N2 assim que N1 estiver estável.
> Formatter enriquecido do digest permanece em N3 Sprint 3.4.

---

## 10. Critério de Sucesso Global

O projeto é considerado entregue quando:

1. ✅ Cenários A–I da tabela de agrupamento (em `IDEA_PLAN_NOTIFICATIONS_REVAMP.md` §Wave N1) passam em validação manual no sandbox bot **e** em device físico mobile.
2. ✅ Tap em push mobile abre `BulkDoseRegisterModal` com checkboxes pré-marcados (cold start e foreground).
3. ✅ Inbox mobile exibe "X/N tomadas" para grouped notifications.
4. ✅ App nativo organiza notificações em Perfil → Avisos → Preferências → Telegram, sem cards paralelos concorrentes.
5. ✅ Canal Web (PWA) é configurável e só envia `web_push` quando flag e subscription ativa existem.
6. ✅ Quiet hours configurado em Settings suprime push em janela definida (validado por device físico durante 24h).
7. ✅ `notification_log.opened_at` é populado quando usuário toca em push (web e mobile).
8. ✅ Copy de "Bom dia" não é idêntica em dois dias consecutivos para o mesmo usuário (seed determinístico válido).
9. ✅ `npm run validate:agent` passa antes de cada PR. `npm run lint` passa antes de commit.
10. ✅ Memória DEVFLOW atualizada com R/AP/ADR após cada wave (3 entries de journal mínimo).

---

## 11. Status de Validação (Wave N2)

### ✅ Entregue em Produção

- Wave N1 (PR #497-#505): Agrupamento por treatment_plan + bulk mobile
- Wave N2 (PR #506-#507): Quiet hours + digest + redesign nativo

### 🧪 Em Validação

**Problema encontrado no Expo dev (2026-04-28):**
- Erro RLS ao registrar device token em dispositivo compartilhado
- Causa: `notification_devices` table com `UNIQUE (provider, push_token)` + UPDATE policy bloqueada quando token já existia para outro user_id
- Resolução: RPC `upsert_notification_device` com SECURITY DEFINER (PR #507) + implementação `INSERT ... ON CONFLICT DO UPDATE` atômica

**Próximos testes:**
- Validar que token é reatribuído corretamente ao novo usuário em dispositivo compartilhado
- Confirmar que quiet hours suprime push corretamente no horário especificado
- Validar digest_morning mode: apenas 1 push matinal consolidado
- Testar deeplinks de notificações em cold start e foreground

### 🚀 Próximas Ondas

Wave N3 pode começar quando N2 estiver estável em produção. Independência de N3 permite paralelização se necessário.
