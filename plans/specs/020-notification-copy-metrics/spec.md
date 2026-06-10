# Feature Specification: Copy de Notificação & Métricas de Engajamento (Wave N3)

**Feature Directory**: `plans/specs/020-notification-copy-metrics`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: specified — não iniciado
**Tier**: 1 (feature coesa; 1 migração **aditiva**, sem contrato breaking/ADR novo)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Sources**:
- `plans/backlog-notifications/EXEC_SPEC_WAVE_N3_COPY_METRICS.md`
- `plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md`

---

## Context

Lembretes estáticos geram fadiga e abandono. A Wave N3 introduz:
1. **Copy variável e motivacional** — saudações por bloco horário + linhas que celebram streaks de adesão.
2. **Anti-repetição determinística** — escolha de texto por seed `(userId, dia)`, evitando mensagem idêntica em dias seguidos.
3. **Loop de engajamento por ocorrência de dose** — cada notificação se liga a uma `dose_instance_id`; `notification_log` registra `opened_at`, `action_taken_at`, `action_type`.

> **Reality-check (revisão 2026-06-02) — correções contra o repo real:**
> - **Migração vive em `docs/migrations/`** (convenção do projeto), **não** `supabase/migrations/`.
> - **`notification_log` já existe** com `title, body, medicine_name, protocol_name, channels, protocol_id, status, sent_at` (`docs/migrations/20260424_notification_log_v1.sql`). As 4 colunas novas (`opened_at`, `action_taken_at`, `action_type`, `dose_instance_id`) são **aditivas** — ALTER não exige novos GRANTs (regra vale p/ `CREATE TABLE`); RLS já vigente.
> - **O log NÃO é criado por insert avulso.** Hoje nasce em `server/notifications/dispatcher/_dispatchHelpers.js:138` via `notificationLogRepository.create()` (fase única, status final). O "2-fase" **refatora essa chamada** + adiciona `update`/`markOpened`/`markAction` no **mesmo** `notificationLogRepository`. **Não criar insert paralelo** (CLAUDE.md: `shouldSendNotification()` já loga — não duplicar).
> - **Schema Zod canônico**: `packages/core/src/schemas/notificationLogSchema.js` (com `src/`).
> - **Streak no server**: o dispatcher/copy é **Node server-side** — usar o helper de streak de `server/bot/_adherenceHelpers.js`, **não** `adherenceService.getCurrentStreak` (que é web, `apps/web/src/services/api/...`, não importável no server).
> - **Action types** alinhados ao bot real (`server/bot/callbacks/doseActions.js`).

---

## User Scenarios & Testing

### User Story 1 — Mensagem Motivacional (P1)
**Why**: incentivar adesão celebrando tomadas consecutivas.
**Independent Test**: simular lembrete para usuário com streak de 8 dias no bloco manhã; verificar saudação dinâmica + linha de streak do 8º dia.

**Acceptance Scenarios**:
1. Given streak de 8 dias, When dispara a dose das 08:00, Then a mensagem traz saudação matinal (*"☀️ Bom dia!"*) + *"🔥 8º dia em sequência — continue firme!"*.

### User Story 2 — Conversão por Push Clicado (P1)
**Why**: medir resposta real a lembretes.
**Independent Test**: enviar push (mobile/web), tocar, abrir o app, verificar `notification_log.opened_at` preenchido na linha da `dose_instance_id`.

**Acceptance Scenarios**:
1. Given um log criado em `status='pending'` referenciando `dose_instance_id`, When o usuário clica no push, Then o helper idempotente atualiza `opened_at = now()` (só se `opened_at IS NULL`).

### User Story 3 — Ações do Bot Telegram (P1)
**Why**: rastrear quais botões geram tomada.
**Independent Test**: disparar alerta de dose no Telegram, clicar `✅ Tomar`, ver a dose virar `taken` e o log popular `action_taken_at` + `action_type`.

**Acceptance Scenarios**:
1. Given alerta de dose no Telegram, When clica `✅ Tomar`, Then a dose é registrada (via fluxo existente do bot) e o log grava `action_taken_at = now()` + `action_type` correspondente.

---

## Edge Cases

- **Streak quebrado na véspera** (`previousStreak >= 7`): copy de recomeço *"💔 Sua sequência de X dias foi quebrada — tudo bem, recomeça hoje!"*.
- **Offline ao abrir push (mobile)**: enfileirar o evento de tracking localmente e sincronizar via DLQ na próxima conexão.
- **Inbox vs. Push**: `read_at` (abriu a tela de Inbox) ≠ `opened_at` (tocou no push/CTA). Visualização passiva de lista NÃO popula `opened_at`.
- **Falha na criação do log (fase 1)**: fail-safe — o envio do push ocorre mesmo assim; o log é criado retroativamente. Sem travar o dispatch.

---

## Requirements

### Functional Requirements

- **FR-001**: Migração **aditiva** em `docs/migrations/` estende `notification_log` com `opened_at TIMESTAMPTZ`, `action_taken_at TIMESTAMPTZ`, `action_type TEXT`, `dose_instance_id UUID REFERENCES public.dose_instances(id) ON DELETE SET NULL` + índices. Política RLS de UPDATE por dono (verificar se já existe antes de criar).
- **FR-002**: Sincronizar `packages/core/src/schemas/notificationLogSchema.js` com os 4 campos novos (sem remover os existentes).
- **FR-003**: Refatorar o logging do dispatcher (`server/notifications/dispatcher/_dispatchHelpers.js`, hoje `:138`) p/ 2 fases **reusando `notificationLogRepository`**: fase 1 cria `status='pending'` com `dose_instance_id` e devolve `id`; injeta `notificationLogId` no payload; fase 2 marca `sent`/`failed`. Adicionar métodos `update`/`markOpened`/`markAction` no repositório (não insert paralelo).
- **FR-004**: `server/bot/notificationCopy.js` [NEW] — pools de saudação por bloco horário + linhas de streak; seletor por seed determinística `(userId, dateStr)`; streak via `server/bot/_adherenceHelpers.js`.
- **FR-005**: Trackers idempotentes de abertura: web `apps/web/src/App.jsx` (intercepta `?notif=id`, chama update, limpa URL via `history.replaceState`); mobile `apps/mobile/src/platform/notifications/usePushNotifications.js` (clique no push). Telegram `doseActions.js` grava `action_taken_at`+`action_type` no clique de tomada.

### Key Entities

- **notification_log** (estende existente): + `opened_at`, `action_taken_at`, `action_type`, `dose_instance_id`. Ciclo: `pending → sent/failed → opened → action`.
- **action_type**: `'opened' | 'take_all' | 'take_plan' | 'take_misc' | 'snooze' | 'skip'` (alinhar aos callbacks reais do bot).

---

## Success Criteria

- **SC-001**: Pools dinâmicos sem repetição consecutiva (mesma seed → mesmo texto; dia seguinte → texto diferente garantido).
- **SC-002**: 100% dos pushes de dose abertos/respondidos populam `opened_at`/`action_taken_at`, via **um** caminho de log (sem duplicação).
- **SC-003**: RLS permite UPDATE só do próprio log.

---

## Assumptions

- Streak lido eficientemente do helper server-side sobre o modelo `dose_instances`.
- Payloads Expo/Telegram comportam o `notificationLogId` sem estourar limite.
