-- Spec 043 (Slice B) — Higiene de notification_devices (FR-005). Trilha de confiabilidade.
-- Problema (AP-208): cada bump de versão do app acumulava rows ativos p/ o mesmo aparelho
-- físico (fingerprint incluía appVersion → tokens distintos por versão + rotação de token Expo).
-- Sintoma: revisor de loja `1bfec269` com 24 devices ativos = 1 aparelho físico × 10 versões
-- → 24 pushes idênticos por notificação (spam + mascara diagnóstico).
--
-- Mecanismo real: TTL por `last_seen_at`. Rows de versões/tokens antigos não são mais reabertos
-- (o upsert só toca o token da versão instalada), então seu `last_seen_at` envelhece e o device
-- é DESATIVADO (nunca deletado — auditoria preservada).
--
-- TTL = 30 dias (decisão do operador 2026-07-09): a prod mostrou o farm do reviewer todo com
-- last_seen_at < 32d (0 além de 60d, 5 além de 30d). 60d desativaria 0 hoje; 30d inicia o
-- colapso imediato (reviewer 24→~19) protegendo aparelho único de usuário ocioso até 30d.
-- Colapso completo até ≤ aparelhos reais é gradual (SC-002/SC-003, observação pós-merge).
--
-- Aditiva, reversível. NÃO toca a tabela nem a RPC upsert_notification_device (PO-SEC-5 N/A).
-- Multi-device legítimo (iPhone+iPad) e contas cuidador (spec 009) intocados: o TTL age por
-- device ABANDONADO (sem atividade além do TTL), nunca por contagem.

-- 1. Política de higiene — service-only, append-safe (nunca DELETE).
--    SECURITY DEFINER + search_path='' (hardening CLAUDE.md); UPDATE em massa cross-user roda
--    só sob privilégio de serviço (pg_cron/service_role). Retorna a contagem desativada (obs.).
CREATE OR REPLACE FUNCTION public.deactivate_stale_notification_devices(ttl_days int DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_now   timestamptz := now();  -- now() já é estável na txn; variável torna o instante explícito/determinístico
BEGIN
  UPDATE public.notification_devices
     SET is_active  = false,
         updated_at = v_now
   WHERE is_active
     AND last_seen_at IS NOT NULL                                    -- guarda defensiva (coluna é NOT NULL)
     AND last_seen_at < v_now - make_interval(days => ttl_days);     -- device abandonado além do TTL
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 2. Least-privilege (PO-SEC-1): nenhuma superfície authenticated/anon pode disparar higiene em massa.
REVOKE EXECUTE ON FUNCTION public.deactivate_stale_notification_devices(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deactivate_stale_notification_devices(int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deactivate_stale_notification_devices(int) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.deactivate_stale_notification_devices(int) TO service_role;

-- 3. Agendamento diário via pg_cron (precedente ADR-077). Job roda no db postgres como serviço.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'deactivate-stale-notification-devices',
  '30 3 * * *',
  $$ SELECT public.deactivate_stale_notification_devices(30) $$
);

-- 4. One-shot retroativo (FR-005b): aplica a MESMA condição imediatamente sobre o lixo histórico
--    acumulado pelo AP-208. One-shot basta porque o FR-006 (fingerprint sem appVersion) elimina
--    a produção de novas duplicatas daqui pra frente.
SELECT public.deactivate_stale_notification_devices(30);

-- Rollback:
--   SELECT cron.unschedule('deactivate-stale-notification-devices');
--   DROP FUNCTION IF EXISTS public.deactivate_stale_notification_devices(int);
--   (rows desativados permanecem is_active=false; reativação manual se necessário.)
