# Implementation Plan: Copy de Notificação & Métricas (Wave N3)

**Feature Directory**: `plans/specs/020-notification-copy-metrics`
**Spec**: `spec.md` · **Revised**: 2026-06-02 · **Tier**: 1

---

## Technical Context

Refatora o logging do dispatcher p/ 2 fases (preflight `pending` → markSent), liga cada notificação a uma `dose_instance_id`, cria a lib de copy dinâmico anti-fadiga e trackers reativos client-side (web/mobile/telegram) sob RLS. Sem novas funções serverless (R-090) — tracking via Supabase client + RLS.

**Paths reais verificados:**
- Dispatcher: `server/notifications/dispatcher/dispatchNotification.js` + `_dispatchHelpers.js` (log nasce em `:138` via `notificationLogRepository.create`). ✅
- Repositório: `server/notifications/repositories/notificationLogRepository.js` (`create`, `listByUserId`). **Adicionar `update`/`markOpened`/`markAction`.** ✅
- Schema: `packages/core/src/schemas/notificationLogSchema.js`. ✅
- Copy lib: `server/bot/notificationCopy.js` [NEW]; digest em `server/bot/tasks.js`. ✅
- Streak server: `server/bot/_adherenceHelpers.js`. ✅ (NÃO `apps/web/.../adherenceService.js`)
- Web tracker: `apps/web/src/App.jsx`. ✅ Mobile: `apps/mobile/src/platform/notifications/usePushNotifications.js`. ✅ Bot: `server/bot/callbacks/doseActions.js` (`:96`). ✅
- Migração: `docs/migrations/20260602_notification_log_metrics.sql` [NEW]. ✅ (NÃO `supabase/migrations/`)

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| R-090 (serverless ≤12) | ✅ | Tracking via Supabase client + RLS; zero função nova na Vercel. |
| R-221 (SQP) | ✅ | Minor; bump core/web; CHANGELOG. |
| single-source-of-truth | ✅ | Um caminho de log (refatora o `create` existente; sem insert paralelo — CLAUDE.md). |
| Health Data Safety | ✅ | RLS UPDATE por dono. |

---

## Architecture / Approach

### 1. Migração (aditiva) — `docs/migrations/20260602_notification_log_metrics.sql`
```sql
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS opened_at        timestamptz,
  ADD COLUMN IF NOT EXISTS action_taken_at  timestamptz,
  ADD COLUMN IF NOT EXISTS action_type      text,  -- 'opened'|'take_all'|'take_plan'|'take_misc'|'snooze'|'skip'
  ADD COLUMN IF NOT EXISTS dose_instance_id uuid REFERENCES public.dose_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_dose_instance
  ON public.notification_log(dose_instance_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_unopened
  ON public.notification_log(user_id, opened_at) WHERE opened_at IS NULL;

-- RLS de UPDATE por dono — só criar se ainda não existir (tabela já tem RLS habilitada).
-- Verificar pg_policies antes; não duplicar policy.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename='notification_log' AND policyname='notification_log_update_own') THEN
    CREATE POLICY notification_log_update_own ON public.notification_log
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
```
> ALTER (add column) não exige novos GRANTs. Sincronizar `notificationLogSchema.js` mantendo os campos existentes (`title`,`body`,`medicine_name`,`protocol_name`,`channels`,`protocol_id`,`status`,`sent_at`).

### 2. Dispatcher em 2 fases (refatora `_dispatchHelpers.js:138`)
- **Fase 1 (preflight)**: `notificationLogRepository.create({ ...status:'pending', dose_instance_id })` **antes** do envio; captura `id`.
- **Payload enrichment**: injeta `notificationLogId = id` na metadata (Expo data push + Telegram callback data — respeitar <64 bytes do callback: usar índice/short id, não UUID cru se estourar).
- **Dispatch**: `Promise.allSettled` nos canais (já existe).
- **Fase 2 (markSent)**: `notificationLogRepository.update(id, { status, sent_at, channels })`.
- **Fail-safe**: falha na fase 1 não trava o envio; cria log retroativo.
> **Não** adicionar um segundo insert — o `create` atual (`:138`) é movido para a fase 1. Confere com CLAUDE.md ("não chamar logNotification depois de shouldSendNotification").

### 3. `notificationCopy.js` [NEW] (server)
- `blockOf(hour)`: Manhã (05-10:59), Almoço (11-13:59), Tarde (14-17:59), Noite (18-22:59), Madrugada (23-04:59), cada um com pool de saudações.
- Seed determinística:
  ```js
  function getSeedHash(userId, dateStr) {
    const s = `${userId}-${dateStr}`; let h = 0;
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return Math.abs(h);
  }
  ```
  Índice = `getSeedHash(...) % pool.length`.
- Streak (via `server/bot/_adherenceHelpers.js`): ≥30 → 🎯; ≥7 → 🔥 `Xº dia`; quebrado véspera (`prev≥7`) → 💔 recomeço; <7 → `null` (omite linha).

### 4. Trackers
- **markNotificationOpened** (helper): `update notification_log set opened_at=now() where id=$1 and opened_at is null` (idempotente) via `notificationLogRepository.markOpened(id)`.
- **Web** `App.jsx`: se `?notif=id` → `markOpened` + `history.replaceState` limpando o param.
- **Mobile** `usePushNotifications.js`: no clique do push, extrai `notificationLogId` da data → `markOpened`. Offline → fila DLQ.
- **Telegram** `doseActions.js`: nas tomadas, `markAction(id, { action_type, action_taken_at: now() })`.

---

## Target Files

| Path | Purpose | Evidence |
|------|---------|----------|
| `docs/migrations/20260602_notification_log_metrics.sql` | [NEW] colunas + índices + RLS update. | dir verificado |
| `packages/core/src/schemas/notificationLogSchema.js` | sync 4 campos novos. | verificado |
| `server/notifications/repositories/notificationLogRepository.js` | + `update`/`markOpened`/`markAction`. | `:138` caller |
| `server/notifications/dispatcher/_dispatchHelpers.js` | 2 fases (refatora `create` em `:138`). | verificado |
| `server/bot/notificationCopy.js` | [NEW] copy + seed + streak. | — |
| `server/bot/tasks.js` | digest enriquecido + copy reativo. | verificado |
| `server/bot/_adherenceHelpers.js` | fonte de streak (server). | verificado |
| `apps/web/src/App.jsx` | tracker `?notif=id`. | verificado |
| `apps/mobile/src/platform/notifications/usePushNotifications.js` | tracker push mobile. | verificado |
| `server/bot/callbacks/doseActions.js` | grava `action_taken_at`/`action_type`. | `:96` |

---

## Risks

- **Double-logging**: a refatoração deve **mover** o `create` existente p/ fase 1, não somar um insert. (CLAUDE.md)
- **Streak no server**: usar helper server-side, não o `adherenceService` web.
- **Callback Telegram <64 bytes**: se `notificationLogId` (UUID) estourar, trafegar índice/short ref (CLAUDE.md telegram).
- **Distribuição do hash**: testar 100 seeds → todos os índices do pool aparecem (sem viés).
