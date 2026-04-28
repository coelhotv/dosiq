# Wave N2 — C1 Extraction (DEVFLOW)

> **Gerado em:** 2026-04-27  
> **Spec origem:** `plans/backlog-notifications/EXEC_SPEC_WAVE_N2_QUIET_HOURS.md`  
> **Branch:** `feature/wave-n2/quiet-hours-redesign`  
> **PR alvo:** PR #2 do Notifications Revamp

---

## 1. Arquivos — Caminhos Canônicos Verificados

### CRIAR (5 novos arquivos)

| # | Caminho | Sprint | Verificação |
|---|---------|--------|-------------|
| 1 | `docs/migrations/20260427_notification_quiet_hours.sql` | 2.1 | Diretório existe; arquivo não existe |
| 2 | `packages/core/src/schemas/userSettingsSchema.js` | 2.1 | Diretório existe; arquivo não existe |
| 3 | `apps/web/src/schemas/userSettingsSchema.js` | 2.1 | Diretório existe; arquivo não existe |
| 4 | `server/bot/utils/notificationGate.js` | 2.2 | Diretório existe; arquivo não existe |
| 5 | `server/bot/__tests__/notificationGate.test.js` | 2.2 | Padrão confirmado (ver `partitionDoses.test.js` no mesmo dir) |

> `apps/web/src/services/userSettingsService.js` — criar somente se necessário na implementação do 2.8 (hoje não existe)

### MODIFICAR (12 arquivos)

| # | Caminho | Sprint | Verificação |
|---|---------|--------|-------------|
| 6 | `server/bot/tasks.js` | 2.2 + 2.3 | `find` confirmado em `./server/bot/tasks.js` |
| 7 | `server/notifications/policies/resolveChannelsForUser.js` | 2.2 | `find` confirmado |
| 8 | `server/notifications/policies/resolveChannelsForUser.test.js` | 2.2 | `find` confirmado |
| 9 | `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` | 2.4 | `find` confirmado |
| 10 | `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx` | 2.5 | `find` confirmado |
| 11 | `apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx` | 2.6 | `find` confirmado |
| 12 | `apps/mobile/src/features/profile/services/profileService.js` | 2.6 | `find` confirmado |
| 13 | `apps/mobile/src/features/profile/screens/TelegramLinkScreen.jsx` | 2.7 | `find` confirmado |
| 14 | `apps/web/src/views/redesign/Settings.jsx` | 2.8 | `find` confirmado (existe também `apps/web/src/views/Settings.jsx` — NÃO é esse) |
| 15 | `apps/web/src/views/redesign/settings/SettingsRedesign.css` | 2.8 | `find` confirmado |
| 16 | `apps/web/src/shared/services/webpushService.js` | 2.8 | `find` confirmado (entregue em N1.7 / PR #502) |

> **Atenção:** Existem DOIS `Settings.jsx`:
> - `apps/web/src/views/Settings.jsx` — view antiga (NÃO tocar)
> - `apps/web/src/views/redesign/Settings.jsx` ← **alvo correto**

---

## 2. R-193 Cross-check — Arquivos de Notificação

N2 **não adiciona novo `kind`**. Usa `daily_digest` já existente. Status do checklist:

| Ponto R-193 | Arquivo | Status |
|-------------|---------|--------|
| kindSchema Zod inclui `daily_digest` | `server/notifications/payloads/buildNotificationPayload.js` | ✅ linha 11 |
| enum `dispatchInputSchema.kind` inclui `daily_digest` | `server/notifications/dispatcher/dispatchNotification.js` | ✅ linha 14 |
| Suporte no deduplicador | `server/services/notificationDeduplicator.js` | ✅ comentário linha 11 |
| Dedup antes de dispatch | `server/bot/tasks.js` | ✅ `shouldSendNotification` linha 857 |
| Schema aceita tipo | `packages/core/src/schemas/notificationLogSchema.js` | ✅ `z.string()` |
| CTA_MAP, resolveTitle no inbox mobile | `apps/mobile/src/features/notifications/components/NotificationItem.jsx` | ✅ linhas 25, 37, 63 |

**Conclusão R-193:** Nenhuma ação necessária em N2.

---

## 3. DoD Completo — Critérios de Aceite por Sprint

### Sprint 2.1 — Migration + Zod schema sync
- [ ] Migration SQL aplica sem erro em staging
- [ ] Campos adicionados: `quiet_hours_start TIME`, `quiet_hours_end TIME`, `notification_mode TEXT DEFAULT 'realtime'` (CHECK constraint), `digest_time TIME DEFAULT '07:00'`, `channel_mobile_push_enabled BOOLEAN NOT NULL DEFAULT true`, `channel_web_push_enabled BOOLEAN NOT NULL DEFAULT false`, `channel_telegram_enabled BOOLEAN NOT NULL DEFAULT false`
- [ ] Backfill correto: `mobile_push` → mobile=true, telegram=false; `telegram` → mobile=false, telegram=true; `both` → ambos=true; `none` → todos=false
- [ ] `safeParse` aceita `HH:MM` válido e rejeita formato errado
- [ ] `safeParse` aceita enum `notification_mode` válido e rejeita valor fora do enum
- [ ] `notification_preference` mantido como campo legado (não remover)
- [ ] Schema web e core sincronizados com os mesmos campos

### Sprint 2.2 — Server: gate + supressão
- [ ] `notificationGate.js` exporta `shouldSendNow({ mode, quietHoursStart, quietHoursEnd, currentHHMM })`
- [ ] `isInQuietHours` trata janela cross-midnight: `22:00→07:00` = `>= 22:00 || < 07:00`
- [ ] `isInQuietHours` trata janela normal: `13:00→15:00` = `>= 13:00 && < 15:00`
- [ ] `mode === 'silent'` → retorna `false` (sempre suprime)
- [ ] `mode === 'digest_morning'` → retorna `false` (suprime lembretes realtime)
- [ ] `mode === 'realtime'` dentro de quiet hours → retorna `false`
- [ ] `mode === 'realtime'` fora de quiet hours → retorna `true`
- [ ] `quiet_hours_start/end = null` → quiet hours desativados (não suprime por horário)
- [ ] `checkRemindersViaDispatcher` lê `notification_mode`, `quiet_hours_start`, `quiet_hours_end` de `user_settings`
- [ ] Notificações suprimidas geram entrada no inbox/auditoria com status `suprimida` (ou equivalente)
- [ ] `resolveChannelsForUser` retorna `web_push` somente quando `channel_web_push_enabled === true` E device ativo com `provider = 'webpush'`
- [ ] `resolveChannelsForUser` mantém lógica legada de `notification_preference` como fallback
- [ ] Todos os testes de `notificationGate.test.js` passam
- [ ] Todos os testes de `resolveChannelsForUser.test.js` passam (flags × devices)

### Sprint 2.3 — Server: trigger digest simples
- [ ] `runDailyDigest` verifica `notification_mode === 'digest_morning'` antes de disparar
- [ ] Dispara somente quando `currentHHMM === user.digest_time`
- [ ] Dispara exatamente 1 push via `dispatcher.dispatch()` com `kind = 'daily_digest'`
- [ ] Title: `Sua agenda de hoje — X doses programadas`
- [ ] Body: lista flat de horários e nomes dos protocolos
- [ ] MarkdownV2 válido quando canal for Telegram
- [ ] Não envia para modo `realtime` ou `silent`
- [ ] Não envia fora do horário configurado

### Sprint 2.4 — Mobile Perfil redesign
- [ ] Seção "Avisos & Lembretes" com único card "Notificações" (ícone Bell)
- [ ] Card tem badge de não lidas via `useUnreadNotificationCount`
- [ ] Card navega para `ROUTES.NOTIFICATION_INBOX` em 1 tap
- [ ] Cards separados de "Preferências de Notificação", "Central de Avisos" e "Bot Telegram" removidos do Perfil
- [ ] Telegram não aparece como seção autônoma no Perfil
- [ ] Badge vermelho ausente quando `unreadCount === 0`
- [ ] Sem regressão no logout

### Sprint 2.5 — Mobile Inbox redesign
- [ ] Header: back icon + título "Avisos" + gear à direita
- [ ] Gear navega para `ROUTES.NOTIFICATION_PREFERENCES`
- [ ] Chips horizontais: Todos / Não lidos / Doses / Estoque
- [ ] Filtro "Não lidos": itens sem leitura
- [ ] Filtro "Doses": tipos `dose_reminder`, `dose_reminder_by_plan`, `dose_reminder_misc`, `missed_dose`, `daily_digest`
- [ ] Filtro "Estoque": tipo `stock_alert`
- [ ] Filtros mudam a lista sem refetch desnecessário
- [ ] Agrupamento temporal preservado (Hoje, Ontem, labels em caixa alta)
- [ ] Zero state: título "Tudo em dia por aqui" + body explicativo
- [ ] Zero state funciona para filtro sem resultados também
- [ ] CTAs de N1 preservados (registrar dose/plano/doses, ver estoque)
- [ ] Unread dot no canto superior direito dos cards

### Sprint 2.6 — Mobile Preferências redesign
- [ ] Card "Notificações ativas" com switch global
- [ ] Seção Canais: App (push), Telegram, Web (PWA), Email (disabled)
- [ ] App push: pede permissão nativa antes de ativar se ausente
- [ ] Telegram: status CONECTADO/DESCONECTADO + chevron para `ROUTES.TELEGRAM_LINK`
- [ ] Web (PWA): mostra ATIVO/INATIVO/"Configure pelo navegador" — não tenta criar SW
- [ ] Email: visível mas disabled
- [ ] Modo de envio: seleção entre `realtime`, `digest_morning`, `silent`
- [ ] Quiet hours: switch + 2 seletores de hora persistem em DB
- [ ] Hora do resumo: visível somente quando `notification_mode === 'digest_morning'`
- [ ] Mensagem de erro se todos os canais externos estiverem off com notificações ativas
- [ ] `notification_preference` legado atualizado como backcompat
- [ ] Todo switch/row tem `accessibilityLabel`
- [ ] AP-059 respeitado: sem CSS vars em RN — usar tokens JS/hex
- [ ] AP-H16 respeitado: sem pt-EU

### Sprint 2.7 — Mobile Telegram redesign
- [ ] Back icon funcional
- [ ] Ícone Telegram grande
- [ ] Título "Conectar ao Telegram"
- [ ] Copy: "Receba lembretes e registre doses direto pelo chat. Vai levar uns 30 segundos."
- [ ] Passo 1: "Abra o bot no Telegram" + CTA "Abrir @dosiq_bot"
- [ ] Passo 2: "Envie este código no chat" + caixa escura com `/start TOKEN`
- [ ] Botão/ícone para copiar código (sem dependência nova se possível)
- [ ] Ação "Gerar novo código"
- [ ] Nota de segurança presente
- [ ] Estado conectado/desconectado claros
- [ ] Sem texto pt-EU

### Sprint 2.8 — Web Settings UI
- [ ] Seção Canais: App (informativo), Web PWA (switch funcional), Telegram (status), Email (disabled)
- [ ] Ativar Web PWA: chama `webpushService.subscribe()` + grava `channel_web_push_enabled = true`
- [ ] Desativar Web PWA: grava `channel_web_push_enabled = false`
- [ ] Browser sem suporte a Push API: row disabled com mensagem curta
- [ ] Modo de notificação (3 opções) persistido no DB
- [ ] Quiet hours: switch + 2 inputs `type="time"` persistidos
- [ ] Hora do resumo visível somente quando `digest_morning`
- [ ] Validação: `quiet_hours_start` e `quiet_hours_end` ambos ou nenhum
- [ ] Pelo menos 1 canal ativo quando `notification_mode !== 'silent'`
- [ ] Reload mantém valores salvos
- [ ] Settings cross-platform: web → mobile e mobile → web refletem

---

## 4. Contratos Tocados

| Contrato | Tipo de mudança | Ação |
|----------|-----------------|------|
| CON-017 `resolveChannelsForUser` | Não-breaking (additive) | Adicionar code path para flags explícitas; manter legado |

---

## 5. Regras Relevantes

| Regra | Aplicação |
|-------|-----------|
| R-082 | Schema Zod e DB DEVEM estar sincronizados (novos campos CHECK/NOT NULL) |
| R-085 | `.nullable().optional()` para campos que podem ser null do DB |
| R-031 | `escapeMarkdownV2()` no digest Telegram |
| R-032 | `shouldSendNotification()` já loga internamente |
| R-121 / R-130 | Validar leitura e escrita com `safeParse()` nos services |
| R-131 | Queries Supabase com datas via UTC via parseLocalDate |
| R-167 | Logs RN protegidos por `if (__DEV__)` |
| R-169 | Screens RN usam safe area |
| R-193 | N/A — sem novo kind |

---

## 6. Anti-patterns a Vigiar

| AP | Risco |
|----|-------|
| AP-115 | Se por acaso adicionar kind novo, atualizar enum Zod dispatcher |
| AP-H16 | Mobile: usar pt-BR (tomar, tomadas) não pt-EU |
| AP-059 | RN: usar tokens JS/hex, nunca CSS vars |
| AP-117 | Params de navegação com contrato tipado entre emissor e receptor |
| AP-118 | INSERT deve espelhar todos os campos do schema após adição |
