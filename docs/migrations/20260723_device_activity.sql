-- Heartbeat de atividade do app, independente de push (spec 057 / ADR-089).
--
-- `notification_devices` só é populada quando o usuário ACEITA push (R-239: pedido só em pontos
-- de intenção, nunca no 1º load) — usuário que usa o app sem nunca aceitar push é invisível a
-- qualquer query de frota/engajamento (mesmo furo do ADR-088 "piso, não retrato" — AP-314).
--
-- Tabela DEDICADA em vez de estender `notification_devices` (ADR-089): esta última exige
-- `push_token`/`provider` e sua UNIQUE de conflito é `(provider, push_token)` — misturaria
-- semântica de "canal de push configurado" com "device visto rodando o app".
--
-- MOBILE-ONLY de propósito (decisão RC3 2026-07-22, spec.md §Ceremony: eng-review): o risco que
-- motivou a spec — DROP de coluna quebrando app INSTALADO desatualizado (ADR-088/AP-314) — não se
-- aplica a web (sempre serve o build atual). CHECK de platform não inclui 'web'.

CREATE TABLE IF NOT EXISTS device_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- R-287
  device_fingerprint text NOT NULL, -- mesma estratégia da 043 (os/osVersion/deviceModel, SEM appVersion na chave — AP-208)
  platform text NOT NULL CHECK (platform IN ('ios', 'android')), -- SEM 'web' — decisão RC3
  app_version text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_device_activity_user_id
  ON device_activity (user_id);

CREATE INDEX IF NOT EXISTS idx_device_activity_last_seen
  ON device_activity (last_seen_at);

-- Grants obrigatórios (docs/standards/SUPABASE_MIGRATIONS.md — tabelas novas não recebem
-- grants automáticos desde 30/10/2026). Escrita de fato só passa pela RPC abaixo (SECURITY
-- DEFINER, deriva o dono de auth.uid()); as policies de linha própria cobrem qualquer leitura/
-- escrita direta futura sem abrir superfície entre usuários.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_activity TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_activity TO service_role;

ALTER TABLE public.device_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own device activity"
  ON device_activity FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device activity"
  ON device_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device activity"
  ON device_activity FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPC para gravar o heartbeat. Espelha `upsert_notification_device` em segurança (achado
-- mecânico RC3): SECURITY DEFINER + search_path fixo + REVOKE ALL FROM PUBLIC + GRANT a
-- authenticated. `user_id` SEMPRE vem de auth.uid() — nunca de parâmetro; não existe
-- superfície para o chamador nomear outro usuário (R-295 aplicado ao design da função).
CREATE OR REPLACE FUNCTION upsert_device_activity(
  p_device_fingerprint text,
  p_platform           text,
  p_app_version        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO device_activity (
    user_id,
    device_fingerprint,
    platform,
    app_version,
    last_seen_at
  ) VALUES (
    v_user_id,
    p_device_fingerprint,
    p_platform,
    p_app_version,
    now()
  )
  ON CONFLICT (user_id, device_fingerprint) DO UPDATE SET
    platform     = EXCLUDED.platform,
    app_version  = EXCLUDED.app_version,
    last_seen_at = now();
END;
$$;

-- REVOKE explícito de `anon` (não só `PUBLIC`): este projeto tem ALTER DEFAULT PRIVILEGES no
-- schema public que concede EXECUTE diretamente a anon/authenticated/service_role na CRIAÇÃO da
-- função — REVOKE ... FROM PUBLIC sozinho não atinge esse grant direto (AP-278: confirmado ao
-- vivo nesta migração via has_function_privilege('anon', ..., 'EXECUTE') = true até este REVOKE
-- rodar; auditar sempre, nunca confiar só no texto do REVOKE FROM PUBLIC).
REVOKE ALL ON FUNCTION upsert_device_activity(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_device_activity(text, text, text) TO authenticated;
