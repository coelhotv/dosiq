-- Spec 043 (Slice A) — notification_outbox (ADR-078). Trilha de confiabilidade (o "50%").
--
-- Fila de RELATÓRIOS em Postgres: enfileiramento por RANGE de elegibilidade + drenagem
-- idempotente. Substitui o disparo minuto-exato dos relatórios (família AP-259: tick pulado
-- às 09:00 no tz do usuário = relatório perdido) por "exatamente-uma notificação por
-- (usuário, kind, período)" garantida pela UNIQUE constraint (idempotência por construção).
--
-- SEC-1/LGPD: a fila guarda SÓ REFERÊNCIAS (user_id + kind + period_key). Nenhum payload,
-- nenhum conteúdo clínico, nenhum push token. O drenador CONSTRÓI o conteúdo no envio a
-- partir dos dados frescos (settings/devices/adesão) — a fila é um "quem/quando", não um "o quê".
-- SEC-2: RLS habilitada + ZERO grants authenticated/anon → tabela server-internal (service_role
-- via cron). SEC-3: channel_results usa contagens/device_id, nunca token bruto. SEC-4: prune 90d.
--
-- Reminders ficam FORA da outbox (ADR-057 intacto; idempotência via dose_instances.notified_at).
-- Cutover kind-a-kind atrás de OUTBOX_KINDS (env csv; ausente = job legado). Reversível por env.
-- FK ON DELETE CASCADE conforme T000 (exclusão de conta LGPD art.16).

-- 1. Tabela — referências apenas (SEC-1).
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN (
                    'daily_adherence','weekly_adherence','monthly_report','daily_digest','stock_alert'
                  )),
  period_key      text NOT NULL,
  -- 'processing' = reivindicada por um drenador (exclusão mútua sob concorrência — Gemini #734).
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  attempts        int  NOT NULL DEFAULT 0,
  channel_results jsonb,  -- [{channel, attempted, delivered, failed, deactivated_count}] — SEM tokens (SEC-3)
  created_at      timestamptz NOT NULL DEFAULT now(),
  claimed_at      timestamptz,  -- quando entrou em 'processing'; NULL em pending/terminal. Recupera stuck.
  sent_at         timestamptz,
  -- Idempotência por constraint (ADR-078): 1 linha por (usuário, kind, período).
  CONSTRAINT notification_outbox_uniq UNIQUE (user_id, kind, period_key)
);

-- Índice de drenagem: pending mais antigo primeiro (claim FOR UPDATE SKIP LOCKED).
CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON public.notification_outbox (created_at)
  WHERE status = 'pending';

-- 2. RLS + grants (SEC-2): tabela server-internal. RLS habilitada e SEM policies para
--    authenticated/anon → nenhuma leitura/escrita por usuário. service_role (cron/drenador)
--    bypassa RLS. Nenhum GRANT a authenticated/anon é emitido (novas tabelas pós-30/10 não
--    recebem grants automáticos — CLAUDE.md). service_role já tem acesso via bypass.
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_outbox TO service_role;
-- ⚠️ Este projeto TEM default privileges legados que auto-concedem grants a anon/authenticated
-- em tabelas novas do schema public (a nota da CLAUDE.md "novas tabelas não recebem grants" NÃO
-- vale aqui — verificado em prod 2026-07-10). RLS sem policy já nega linhas, mas removemos os
-- grants por defense-in-depth e para satisfazer PO-SEC-2 (zero grant authenticated/anon).
REVOKE ALL ON public.notification_outbox FROM anon;
REVOKE ALL ON public.notification_outbox FROM authenticated;

-- 3. Claim atômico (ENG-4/ADR-078): reivindica um lote e o marca 'processing' na MESMA transação.
--    Exclusão mútua sob concorrência (Gemini #734): sem mudar o status, após o commit do RPC o
--    lock solta e outro drenador re-reivindicaria a MESMA linha (envio duplicado). 'processing'
--    tira a linha do conjunto reivindicável enquanto o envio assíncrono roda.
--    FOR UPDATE SKIP LOCKED → lotes disjuntos sem bloquear. attempts++ no claim limita reciclagem
--    de linha-veneno. Recuperação de stuck: linhas presas em 'processing' há >15min (drenador que
--    crashou entre claim e finalize) voltam a ser elegíveis — senão 'processing' vira buraco negro.
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

-- 4. Prune de retenção 90d (SEC-4/LGPD — minimização de trilha de entrega de dado de saúde).
--    Função privilegiada + pg_cron (precedente ADR-077). Remove linhas já resolvidas antigas.
CREATE OR REPLACE FUNCTION public.prune_notification_outbox(retention_days int DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.notification_outbox
   WHERE created_at < now() - make_interval(days => retention_days);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_notification_outbox(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prune_notification_outbox(int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.prune_notification_outbox(int) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.prune_notification_outbox(int) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'prune-notification-outbox',
  '15 3 * * *',
  $$ SELECT public.prune_notification_outbox(90) $$
);

-- Rollback:
--   SELECT cron.unschedule('prune-notification-outbox');
--   DROP FUNCTION IF EXISTS public.prune_notification_outbox(int);
--   DROP TABLE IF EXISTS public.notification_outbox;
