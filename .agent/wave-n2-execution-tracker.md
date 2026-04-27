# Wave N2 — Execution Tracker (DEVFLOW)

> **Gerado em:** 2026-04-27  
> **Atualizado em:** 2026-04-27 — C4 concluído: 543 testes passando, 0 falhas, 36 testes server (notificationGate + resolveChannels)  
> **Branch:** `feature/wave-n2/quiet-hours-redesign` — 12 commits, aguardando PR  
> **Spec:** `plans/backlog-notifications/EXEC_SPEC_WAVE_N2_QUIET_HOURS.md`  
> **C1 completo:** `.agent/wave-n2-c1-extraction.md`

---

## Status Geral

| Sprint | Descrição | Agente | Status | Commit |
|--------|-----------|--------|--------|--------|
| **2.1** | Migration SQL + Zod schema | 🟡 Haiku | ✅ Completo | 53d19e62 |
| **2.2** | Server: notificationGate + resolveChannels | 🟢 Sonnet | ✅ Completo | 71850a0a + 5b28c190 + 6d7ff115 |
| **2.3** | Server: digest trigger simples | 🟡 Haiku | ✅ Completo | 23478b95 |
| **2.4** | Mobile ProfileScreen redesign | 🟢 Sonnet | ✅ Completo | 59c103ab |
| **2.5** | Mobile NotificationInboxScreen redesign | 🟢 Sonnet | ✅ Completo | 3de1b872 |
| **2.6** | Mobile NotificationPreferencesScreen redesign | 🟢 Sonnet | ✅ Completo | 0ac9812b |
| **2.7** | Mobile TelegramLinkScreen redesign | 🟡 Haiku | ✅ Completo | 133d2bc6 |
| **2.8** | Web Settings canais + quiet hours + digest | 🟡 Haiku | ✅ Completo | e87dc8b7 |
| **2.9** | Validação manual + DEVFLOW C5 | ⚪ Humano | ⬜ Pendente | — |

**Legenda:** ⬜ Pendente · 🔄 Em progresso · ✅ Completo · ❌ Bloqueado

---

## Sprint 2.1 — Migration + Zod schema

**Agente:** 🟡 Haiku  
**Status:** ✅ Completo

### Arquivos alvo
- [ ] `docs/migrations/20260427_notification_quiet_hours.sql` — CRIAR
- [ ] `packages/core/src/schemas/userSettingsSchema.js` — CRIAR
- [ ] `apps/web/src/schemas/userSettingsSchema.js` — CRIAR

### DoD checklist
- [ ] Migration SQL aplica sem erro em staging
- [ ] Campos: `quiet_hours_start`, `quiet_hours_end`, `notification_mode` (CHECK), `digest_time`, `channel_mobile_push_enabled` (NOT NULL), `channel_web_push_enabled` (NOT NULL), `channel_telegram_enabled` (NOT NULL)
- [ ] Backfill correto dos booleans a partir de `notification_preference`
- [ ] `safeParse` valida `HH:MM` e enum `notification_mode`
- [ ] Schema web e core sincronizados

### Notas de qualidade
- R-082: schema e DB sincronizados
- R-085: usar `.nullable().optional()` para `quiet_hours_start/end`
- Manter `notification_preference` como legado (não remover)

---

## Sprint 2.2 — Server: gate + supressão

**Agente:** 🟢 Sonnet  
**Status:** ✅ Completo  
**Depende de:** 2.1 (campos em `user_settings`)

### Arquivos alvo
- [ ] `server/bot/utils/notificationGate.js` — CRIAR
- [ ] `server/bot/__tests__/notificationGate.test.js` — CRIAR
- [ ] `server/bot/tasks.js` — MODIFICAR (`checkRemindersViaDispatcher`)
- [ ] `server/notifications/policies/resolveChannelsForUser.js` — MODIFICAR
- [ ] `server/notifications/policies/resolveChannelsForUser.test.js` — MODIFICAR

### DoD checklist
- [ ] `shouldSendNow` exportado com interface `{ mode, quietHoursStart, quietHoursEnd, currentHHMM }`
- [ ] `isInQuietHours` cross-midnight correto
- [ ] `silent` → sempre false
- [ ] `digest_morning` → sempre false (suprime realtime)
- [ ] `realtime` dentro QH → false; fora QH → true
- [ ] `null` start/end → QH desativados
- [ ] `tasks.js` lê os novos campos e aplica gate antes do dispatch
- [ ] Suprimidas geram entrada no inbox com status apropriado
- [ ] `resolveChannelsForUser` suporta flags explícitas (`channel_*_enabled` + device ativo)
- [ ] Legado `notification_preference` mantido como fallback
- [ ] Todos os testes passam

### Notas de qualidade
- CON-017: mudança não-breaking — adicionar code path, não remover legado
- AP-118: INSERT no inbox deve espelhar schema após adição dos novos campos

---

## Sprint 2.3 — Server: digest trigger

**Agente:** 🟡 Haiku  
**Status:** ✅ Completo  
**Depende de:** 2.1 (campo `notification_mode`, `digest_time`)

### Arquivos alvo
- [ ] `server/bot/tasks.js` — MODIFICAR (`runDailyDigest`)

### DoD checklist
- [ ] Filtra por `notification_mode === 'digest_morning'` antes de disparar
- [ ] Dispara somente quando `currentHHMM === user.digest_time`
- [ ] 1 push por usuário via `dispatcher.dispatch({ kind: 'daily_digest' })`
- [ ] Title: `Sua agenda de hoje — X doses programadas`
- [ ] Body: lista flat de horários + nomes dos protocolos
- [ ] MarkdownV2 válido para canal Telegram
- [ ] Sem envio para `realtime` ou `silent`

### Notas de qualidade
- R-031: `escapeMarkdownV2()` obrigatório no body Telegram
- R-032: `shouldSendNotification()` já loga — não chamar `logNotification()` depois

---

## Sprint 2.4 — Mobile ProfileScreen redesign

**Agente:** 🟢 Sonnet  
**Status:** ✅ Completo

### Arquivos alvo
- [ ] `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` — MODIFICAR

### DoD checklist
- [ ] Uma única entrada "Notificações" na seção "Avisos & Lembretes"
- [ ] Badge de não lidas via `useUnreadNotificationCount`
- [ ] Tap → `ROUTES.NOTIFICATION_INBOX`
- [ ] Cards separados de Preferências/Central/Telegram removidos
- [ ] Badge ausente quando `unreadCount === 0`
- [ ] Logout sem regressão

### Notas de qualidade
- R-167: logs RN protegidos por `if (__DEV__)`
- R-169: usar safe area
- AP-H16: pt-BR somente
- AP-059: tokens JS/hex — sem CSS vars

---

## Sprint 2.5 — Mobile NotificationInboxScreen redesign

**Agente:** 🟢 Sonnet  
**Status:** ✅ Completo  
**Depende de:** 2.4 (navegação do Perfil para o Inbox)

### Arquivos alvo
- [ ] `apps/mobile/src/features/notifications/screens/NotificationInboxScreen.jsx` — MODIFICAR

### DoD checklist
- [ ] Header: back + "Avisos" + gear
- [ ] Gear → `ROUTES.NOTIFICATION_PREFERENCES`
- [ ] Chips: Todos / Não lidos / Doses / Estoque
- [ ] Filtro Doses: `dose_reminder`, `dose_reminder_by_plan`, `dose_reminder_misc`, `missed_dose`, `daily_digest`
- [ ] Filtro Estoque: `stock_alert`
- [ ] Filtros sem refetch
- [ ] Agrupamento temporal preservado (CAIXA ALTA)
- [ ] Zero state: "Tudo em dia por aqui" + body; funciona para filtro vazio
- [ ] CTAs N1 preservados
- [ ] Unread dot

---

## Sprint 2.6 — Mobile NotificationPreferencesScreen redesign

**Agente:** 🟢 Sonnet  
**Status:** ✅ Completo  
**Depende de:** 2.1 (novos campos), 2.4 (navegação)

### Arquivos alvo
- [ ] `apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx` — MODIFICAR
- [ ] `apps/mobile/src/features/profile/services/profileService.js` — MODIFICAR

### DoD checklist
- [ ] Switch global "Notificações ativas"
- [ ] Canal App push: permissão nativa antes de ativar
- [ ] Canal Telegram: CONECTADO/DESCONECTADO + chevron para `ROUTES.TELEGRAM_LINK`
- [ ] Canal Web (PWA): ATIVO/INATIVO/"Configure pelo navegador" — sem SW no nativo
- [ ] Canal Email: disabled
- [ ] Modo de envio: `realtime`, `digest_morning`, `silent`
- [ ] Quiet hours: switch + 2 seletores de hora → persistem em DB
- [ ] Hora do resumo: visível somente quando `digest_morning`
- [ ] Erro se todos os canais off com notificações ativas
- [ ] `notification_preference` legado atualizado como backcompat
- [ ] `accessibilityLabel` em todos os switches/rows

---

## Sprint 2.7 — Mobile TelegramLinkScreen redesign

**Agente:** 🟡 Haiku  
**Status:** ✅ Completo

### Arquivos alvo
- [ ] `apps/mobile/src/features/profile/screens/TelegramLinkScreen.jsx` — MODIFICAR

### DoD checklist
- [ ] Back icon funcional
- [ ] Ícone Telegram grande
- [ ] Título "Conectar ao Telegram"
- [ ] Copy correto (pt-BR)
- [ ] Passo 1: "Abra o bot no Telegram" + CTA "Abrir @dosiq_bot"
- [ ] Passo 2: caixa escura com `/start TOKEN` + botão copiar
- [ ] "Gerar novo código" funcional
- [ ] Nota de segurança presente
- [ ] Estado conectado/desconectado claros
- [ ] Sem texto pt-EU

---

## Sprint 2.8 — Web Settings UI

**Agente:** 🟡 Haiku  
**Status:** ✅ Completo  
**Depende de:** 2.1 (novos campos)

### Arquivos alvo
- [ ] `apps/web/src/views/redesign/Settings.jsx` — MODIFICAR (**NÃO** `apps/web/src/views/Settings.jsx`)
- [ ] `apps/web/src/views/redesign/settings/SettingsRedesign.css` — MODIFICAR
- [ ] `apps/web/src/shared/services/webpushService.js` — MODIFICAR (add unsubscribe se necessário)
- [ ] `apps/web/src/services/userSettingsService.js` — CRIAR se necessário

### DoD checklist
- [ ] Seção Canais: App (info), Web PWA (switch), Telegram (status), Email (disabled)
- [ ] Ativar Web PWA: `webpushService.subscribe()` + `channel_web_push_enabled = true`
- [ ] Desativar Web PWA: `channel_web_push_enabled = false`
- [ ] Browser sem Push API: row disabled com mensagem
- [ ] Modo notificação: 3 opções persistidas
- [ ] Quiet hours: switch + 2 inputs `type="time"` persistidos
- [ ] Hora do resumo: visível somente em `digest_morning`
- [ ] Validação: QH start+end ambos ou nenhum
- [ ] Ao menos 1 canal ativo quando `!== 'silent'`
- [ ] Reload preserva valores

---

## Sprint 2.9 — Validação Manual + DEVFLOW C5

**Agente:** ⚪ Humano  
**Status:** ⬜ Pendente

### Checklist E2E
- [ ] Perfil → Notificações → Avisos → gear → Preferências → Telegram
- [ ] Zero state em conta sem notificações
- [ ] Filtros Todos/Não lidos/Doses/Estoque no mobile
- [ ] Web: habilitar Web PWA → cron envia `web_push`
- [ ] Web: desabilitar Web PWA → cron não envia `web_push`
- [ ] `quiet_hours_start=22:00`, `end=07:00` → device físico não recebe push às 23:00
- [ ] `digest_morning 07:00` → 1 push às 07:00 com agenda do dia
- [ ] `silent` → 0 push externo, inbox popula normalmente

### Quality gates
- [ ] `cd apps/web && npm run lint`
- [ ] `cd apps/web && npm run validate:agent`
- [ ] Testes server: verificar comando em `server/package.json`

### DEVFLOW C5
- [ ] ADR-035: política de quiet hours, modos, canais App/Web/Telegram, arquitetura Perfil→Avisos→Preferências→Telegram
- [ ] R-196 candidato: `isInQuietHours` cross-midnight (start > end = spans midnight)
- [ ] R-197 candidato: única porta de entrada de notificações no Perfil
- [ ] R-198 candidato: `web_push` depende de flag + device ativo (não só subscription)
- [ ] Journal entry em `.agent/memory/journal/2026-W18.jsonl`
- [ ] Atualizar `state.json`: `journal_entries_since_distillation` + `status = completed`

---

## Notas de Implementação

### Dependências entre sprints
```
2.1 ─────────┬──→ 2.2 ─→ (tasks.js gate)
             ├──→ 2.3 ─→ (digest trigger)
             └──→ 2.6 ─→ (mobile prefs)
                         └──→ 2.8 (web settings)

2.4 ─→ 2.5 ─→ 2.6 (navegação móvel)

2.7 — independente (redesign puro)
2.1 + 2.7 — podem ser iniciados em paralelo com 2.2/2.4
```

### Armadilha crítica confirmada
> `apps/web/src/views/Settings.jsx` (view antiga) e `apps/web/src/views/redesign/Settings.jsx` (alvo correto) coexistem. **Sempre usar o caminho completo com `/redesign/`.**

### Legado `notification_preference`
> Manter o campo e atualizá-lo como backcompat ao gravar os booleans de canal. A UI nova lê/escreve os booleans; o legado é atualizado derivadamente. Nunca remover o campo nesta wave.
