# Implementation Plan: Snooze de Dose no Telegram

**Feature Directory**: `plans/specs/021-telegram-snooze-dose`
**Spec**: `spec.md` · **Revised**: 2026-06-02 · **Tier**: 1

---

## Technical Context

Snooze integrado a `dose_instances` (`snoozed_until`/`notified_at` já existentes — **sem migração**). Callback do Telegram ≤64 bytes. Cron serverless sem estado — `dose_instances` é a fonte única, consultada a cada minuto.

**Paths reais verificados:**
- `server/notifications/payloads/buildNotificationPayload.js` — ações inline (`:183` `take`, `:184` `skip`; `formatDoseReminder` aqui). ✅
- `server/notifications/channels/telegramChannel.js` — encode de callback (`:19` `take_:`, `:21` `skip_:`, `:22` `takeplan:`). ✅
- `server/bot/callbacks/doseActions.js` — handlers de callback. ✅
- `api/notify.js` — cron `withCorrelation((ctx)=>fn,{correlationId,jobType})` (`:244` reminders, `:251` digest, `:258` adherence). ✅
- `server/notifications/repositories/notificationPreferenceRepository.js` — `user_settings.timezone` (`:84`, default SP `:100`). ✅
- `server/bot/_snoozeHelpers.js` — **[NEW]**.
- ⚠️ **`packages/core/schemas/actionSchema.js` NÃO existe** — não criar; ações são inline (acima).

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| R-020 / multi-tz | ✅ | `snoozed_until` UTC absoluto; confirmação renderizada no `user_settings.timezone` (F4.3). Sem hardcode SP. |
| R-090 (serverless ≤12) | ✅ | Runner dentro de `api/notify.js` (sem função nova). |
| single-source-of-truth | ✅ | `dose_instances` controla estado; sem tabela de jobs. |
| R-221 (SQP) | ✅ | Minor server; CHANGELOG. |

---

## Architecture / Approach

### 1. `_snoozeHelpers.js` [NEW]
- `getAvailableSnoozeOptions(scheduledFor, now=new Date())`: retorna subset de `[15,30,60]` com `now + min < scheduledFor + 120min`.
- `isSnoozeEligible(timeSchedule)`: array `'HH:MM'`; dose única → sempre elegível; ordena, calcula menor gap adjacente (+ gap circular noite→manhã); elegível se gap > 120min.
- `checkSnoozedDoses(dispatcher, correlationId)`: consulta `dose_instances` `snoozed_until <= now() AND status='pending' AND notified_at IS NOT NULL`; para cada, `dispatcher.dispatch({ ..., context:{ isSnoozed:true, originalScheduledHHMM } })`; depois `update snoozed_until=null, notified_at=now()`.

### 2. Handlers no Telegram (`doseActions.js`)
- Callbacks (≤64b): `snooze_:${doseInstanceId}` (44b), `snooze_pick:${minutes}:${doseInstanceId}` (~51b). Registrar **antes** dos handlers genéricos de string.
- `handleSnooze`: carrega a instância + protocolo; valida `isSnoozeEligible` + opções; se ok, edita a mensagem com o teclado `⏰ 15/30/60`. Inelegível → `answerCallbackQuery` pop-up.
- `handleSnoozePick`: re-valida a janela (race); `update dose_instances set snoozed_until = now() + (min * interval '1 minute') where id=...`; edita a mensagem com confirmação no **tz do usuário** (via `notificationPreferenceRepository.timezone`).

### 3. Payload + Layout (`buildNotificationPayload.js` + `telegramChannel.js`)
- `formatDoseReminder`: incluir `{ id:'snooze', label:'⏰ Adiar', params:{ doseInstanceId } }` entre `take` e `skip` (linha única).
- `telegramChannel.js`: `case 'snooze': raw = \`snooze_:${p.doseInstanceId}\`` (espelha o padrão de `take_:`/`skip_:`).
- `applySnoozeDecoration(payload)` quando `context.isSnoozed`: prefixa `⏰ ` no título + linha itálica `_Lembrete adiado (original: HH:MM)_` (HH:MM no tz do usuário).

### 4. Cron (`api/notify.js`)
Adicionar bloco espelhando o padrão real:
```js
await withCorrelation(
  (ctx) => checkSnoozedDoses(notificationDispatcher, ctx.correlationId),
  { correlationId, jobType: 'snooze_reminders' }
)
```

---

## Target Files

| Path | Purpose | Evidence |
|------|---------|----------|
| `server/bot/_snoozeHelpers.js` | [NEW] opções/elegibilidade/runner. | — |
| `server/bot/callbacks/doseActions.js` | `handleSnooze`/`handleSnoozePick`. | `:96` |
| `server/notifications/payloads/buildNotificationPayload.js` | `{id:'snooze'}` + `applySnoozeDecoration`. | `:183` |
| `server/notifications/channels/telegramChannel.js` | `case 'snooze'` encode. | `:19-22` |
| `server/notifications/repositories/notificationPreferenceRepository.js` | fonte do tz do usuário (leitura). | `:84` |
| `api/notify.js` | bloco `snooze_reminders`. | `:244` |

> **Removido** o alvo `packages/core/schemas/actionSchema.js` (não existe).

---

## Risks

- **Path inexistente na fonte**: `actionSchema.js` — ação é inline; não inventar arquivo.
- **TZ**: confirmação **sempre** no `user_settings.timezone`, SP só fallback (F4.3). Não hardcode.
- **Callback >64 bytes**: validar comprimento de `snooze_pick:` com UUID; se estourar, usar short id.
- **Concorrência tomada manual**: runner filtra `status='pending'` → auto-anula.
