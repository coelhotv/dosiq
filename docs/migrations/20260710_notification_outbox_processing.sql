-- Spec 043 (Slice A) — hardening de concorrência da notification_outbox (Gemini #734 re-review).
--
-- A 20260707 já foi aplicada em prod com claim que deixava a linha 'pending' durante o envio
-- assíncrono → drenadores concorrentes re-reivindicavam o mesmo lote (envio duplicado, CRITICAL).
-- Esta migração corretiva introduz o estado 'processing' + claimed_at (exclusão mútua) e a
-- recuperação de linhas presas em 'processing' (drenador que crashou). Idempotente.

-- 1. Coluna claimed_at (quando a linha entrou em 'processing').
ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- 2. CHECK do status inclui 'processing'.
ALTER TABLE public.notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_status_check;
ALTER TABLE public.notification_outbox
  ADD  CONSTRAINT notification_outbox_status_check
  CHECK (status IN ('pending','processing','sent','failed'));

-- 3. Claim marca 'processing' + claimed_at, e recupera 'processing' preso há >15min.
CREATE OR REPLACE FUNCTION public.claim_notification_outbox(batch_limit int DEFAULT 25)
RETURNS SETOF public.notification_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.notification_outbox o
     SET attempts = o.attempts + 1,
         status = 'processing',
         claimed_at = now()
   WHERE o.id IN (
     SELECT id
       FROM public.notification_outbox
      WHERE status = 'pending'
         OR (status = 'processing' AND claimed_at < now() - interval '15 minutes')
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT batch_limit
   )
  RETURNING o.*;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_notification_outbox(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_notification_outbox(int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_notification_outbox(int) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_notification_outbox(int) TO service_role;

-- Rollback: reverter claim para a forma sem status/claimed_at + DROP COLUMN claimed_at +
--           restaurar CHECK sem 'processing' (só se não houver linhas em 'processing').
