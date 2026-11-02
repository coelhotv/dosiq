-- 20261102_device_capability_event.sql — spec 082 Slice D2-server (T092 · PO-D2-5)
--
-- OBJETIVO
--   `dose_critical_events.event` passa a aceitar `device_capability` — o boletim de capacidade de
--   alarme que o app 0.34.2+ emite (FR-015/FR-016a). Boletim com `detail.capable = false` INVALIDA
--   a prova de alarme anterior a ele no gate do servidor (`findLatestIncapableAt`). 13 → 14 valores.
--
--   `dose_instance_id` fica NULL: a capacidade é do USUÁRIO (a tabela não tem coluna de aparelho).
--   `detail` é ALLOWLIST FECHADA, só fatos binários/contagens do aparelho (capable,
--   notifications_allowed, alarm_channel_blocked, exact_alarm_allowed, critical_expected,
--   critical_armed, app_version) — nunca nome ou dosagem de medicamento.
--
-- ⚠️ R-271 — CHECK e enum do core andam JUNTOS, no mesmo PR:
--   `packages/core/src/schemas/criticalAuditEventSchema.ts` (CRITICAL_AUDIT_EVENTS) recebe o MESMO
--   literal, caixa idêntica. Verificado antes desta migração (prod, 2026-11-02): os 13 valores dos
--   dois lados eram verbatim idênticos.
--
-- ⚠️ ORDEM (R-D2-1): aplicar em PROD antes do build de loja 0.34.2. Sem o valor no CHECK o insert do
--   boletim morre com 23514 e o fail-open do `emit` esconde — o app não quebra, o boletim só não chega.
--
-- Sem objeto novo e sem mudança de grant (a 20260817 já fixou anon sem acesso e authenticated com
-- SELECT+INSERT) ⇒ nada a conceder aqui.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                  | Análise / mitigação                                   |
-- |---------------------------------------|-------------------------------------------------------|
-- | linha existente viola o CHECK novo    | IMPOSSÍVEL: só ADICIONA valor ao IN. Teste: count por event antes/depois idêntico. |
-- | caixa/grafia divergente do Zod        | 23514 em runtime. Literal colado dos dois lados + bloco 2 do .test.sql (caixa errada falha). |
-- | prune de 90d (pg_cron)                | roda como postgres/service_role, filtra por data ⇒ intocado. |
-- | dado legado                           | nenhum: valor novo, nenhuma linha antiga muda de significado. |
-- | rollback                              | re-ADD do CHECK com os 13 valores (DEPOIS de apagar linhas device_capability, senão o ADD falha). |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Aplicar via Supabase MCP (apply_migration) — QA (ikcvwxyohmntncanclze) primeiro (CON-044), depois
-- prod —, após BEGIN..ROLLBACK do `20261102_device_capability_event.test.sql`.

ALTER TABLE public.dose_critical_events
  DROP CONSTRAINT IF EXISTS dose_critical_events_event_check;

ALTER TABLE public.dose_critical_events
  ADD CONSTRAINT dose_critical_events_event_check
  CHECK (event = ANY (ARRAY[
    'alarm_scheduled'::text,
    'alarm_fired'::text,
    'alarm_suppressed'::text,
    'nag_fired'::text,
    'snoozed'::text,
    'resolved'::text,
    'push_sent'::text,
    'push_failed'::text,
    'surface_transitioned'::text,
    'push_skipped_no_token'::text,
    'token_captured'::text,
    'titration_transitioned'::text,
    'alarm_out_of_window'::text,
    -- 082 D2 (FR-015/FR-016a): boletim de capacidade de alarme do aparelho, por USUÁRIO.
    'device_capability'::text
  ]));

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação pós-aplicação
--   1. CHECK com 14 valores, incluindo o novo:
--      SELECT pg_get_constraintdef(oid) FROM pg_constraint
--       WHERE conname='dose_critical_events_event_check';
--   2. Nenhum evento existente perdido:
--      SELECT event, count(*) FROM public.dose_critical_events GROUP BY 1 ORDER BY 1;
--
-- Rollback
--   DELETE FROM public.dose_critical_events WHERE event = 'device_capability';
--   ALTER TABLE public.dose_critical_events DROP CONSTRAINT dose_critical_events_event_check;
--   -- re-ADD com os 13 valores (sem 'device_capability')
