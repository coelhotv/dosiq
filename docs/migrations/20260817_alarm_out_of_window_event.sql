-- 20260817_alarm_out_of_window_event.sql — spec 067 Slice A2 (T023)
--
-- OBJETIVO (duas mudanças, mesma tabela, mesmo PR)
--   1. `dose_critical_events.event` passa a aceitar `alarm_out_of_window` — a anomalia emitida
--      quando a guarda bilateral barra um disparo (FR-007). 12 → 13 valores.
--   2. `REVOKE ALL ... FROM anon` (FR-031 / RC-SEC/S-4): a trilha é append-only, e hoje isso vale
--      só por AUSÊNCIA de policy de UPDATE/DELETE. Medido em prod 2026-08-17:
--
--        anon          → SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER   ⚠️
--        authenticated → SELECT, INSERT                                                  ✅
--
--      Grant de tabela e policy são camadas INDEPENDENTES que falham de formas diferentes
--      (R-305): privilégio devolve 42501 na hora, RLS devolve "0 linhas" com cara de sucesso.
--      Append-only de trilha clínica não pode depender da camada silenciosa.
--
-- ⚠️ R-271 — CHECK e enum do core andam JUNTOS, no mesmo PR:
--   `packages/core/src/schemas/criticalAuditEventSchema.ts:16` (CRITICAL_AUDIT_EVENTS) recebe o
--   MESMO literal, caixa idêntica. Valor no Zod sem valor no CHECK = insert que morre só em runtime
--   com 23514; valor no CHECK sem valor no Zod = evento que o client se recusa a emitir.
--   Verificado antes desta migração: os 12 valores dos dois lados eram verbatim idênticos.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                    | Análise / mitigação                                 |
-- |-----------------------------------------|-----------------------------------------------------|
-- | linha existente viola o CHECK novo      | IMPOSSÍVEL: a mudança só ADICIONA valor ao IN — nenhum valor deixa de ser aceito. Provado no teste (count por event antes/depois idêntico). |
-- | valor com caixa/acento divergente       | 23514 em runtime. Mitigação: literal `alarm_out_of_window` colado do mesmo lugar nos dois arquivos + teste de grep cruzado (PO-4). |
-- | REVOKE derruba o INSERT do app          | NÃO: o app escreve como `authenticated` (SELECT+INSERT preservados) e o server como `service_role` (intocado). Guard do teste: INSERT como authenticated ainda funciona DEPOIS do revoke. |
-- | anon precisa ler a trilha               | Não existe caso: nenhuma superfície pública lê `dose_critical_events` (RLS já exigia `auth.uid()`, então anon nunca viu linha alguma — o grant era privilégio morto e perigoso). |
-- | default privileges legados reconcedem   | Classe AP-275: `ALTER DEFAULT PRIVILEGES` não é tocado aqui, mas o REVOKE é idempotente e pode ser re-rodado. Verificação pós-aplicação lista os grants. |
-- | prune de 90d (pg_cron) quebra           | Roda como `postgres`/`service_role`, não como anon ⇒ intocado. |
-- | rollback                                | Reversível: re-ADD do CHECK com os 12 valores + re-GRANT p/ anon (que NÃO recomendamos — o grant era o defeito). |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Aplicar via Supabase MCP (apply_migration), após BEGIN..ROLLBACK do
-- `20260817_alarm_out_of_window_event.test.sql`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CHECK do enum de evento: 12 → 13 valores
-- ─────────────────────────────────────────────────────────────────────────────

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
    -- 067 A2 (FR-007): guarda bilateral barrou um disparo fora da janela. `detail` é allowlist
    -- FECHADA (delta_seconds, direction, manufacturer, model, os_version — FR-036): proibido
    -- despejar o payload da notificação, que carrega nome e dosagem do medicamento.
    'alarm_out_of_window'::text
  ]));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Append-only por PRIVILÉGIO, não só por ausência de policy (FR-031 / S-4)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON public.dose_critical_events FROM anon;

-- Reafirma o least privilege de quem de fato escreve (idempotente).
GRANT SELECT, INSERT ON public.dose_critical_events TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação pós-aplicação
--   1. CHECK com 13 valores, incluindo o novo:
--      SELECT pg_get_constraintdef(oid) FROM pg_constraint
--       WHERE conname='dose_critical_events_event_check';
--   2. Grants (esperado: anon sem NENHUMA linha; authenticated com SELECT+INSERT):
--      SELECT grantee, privilege_type FROM information_schema.role_table_grants
--       WHERE table_schema='public' AND table_name='dose_critical_events'
--         AND grantee IN ('anon','authenticated','service_role') ORDER BY 1,2;
--   3. Nenhum evento existente perdido:
--      SELECT event, count(*) FROM public.dose_critical_events GROUP BY 1 ORDER BY 1;
--
-- Rollback
--   ALTER TABLE public.dose_critical_events DROP CONSTRAINT dose_critical_events_event_check;
--   -- re-ADD com os 12 valores originais (sem 'alarm_out_of_window')
--   -- NÃO restaurar os grants de anon: eram o defeito, não o estado desejado.
