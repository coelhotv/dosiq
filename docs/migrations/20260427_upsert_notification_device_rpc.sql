-- RPC para registrar/reivindicar um device token de push notification.
--
-- Modelo "último usuário sobrescreve": um token pertence sempre ao usuário
-- que fez login mais recentemente no dispositivo. Isso garante que em
-- dispositivos compartilhados (ex: múltiplos pacientes) apenas o usuário
-- atual receba os pushes, sem vazamento de dados entre contas.
--
-- Por que RPC em vez de upsert direto:
--   O upsert direto via client falha com RLS quando o token já existe
--   associado a outro user_id (a policy USING bloqueia o UPDATE).
--   SECURITY DEFINER contorna o RLS de forma controlada, validando
--   internamente que o caller está autenticado.

CREATE OR REPLACE FUNCTION upsert_notification_device(
  p_provider          text,
  p_push_token        text,
  p_platform          text,
  p_app_kind          text,
  p_device_name       text,
  p_device_fingerprint text,
  p_app_version       text
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

  -- Remove qualquer registro anterior com o mesmo token (de qualquer usuário).
  -- Garante que o token pertença exclusivamente ao usuário atual.
  DELETE FROM notification_devices
  WHERE provider = p_provider AND push_token = p_push_token;

  -- Insere o registro para o usuário atual.
  INSERT INTO notification_devices (
    user_id,
    provider,
    push_token,
    platform,
    app_kind,
    device_name,
    device_fingerprint,
    app_version,
    is_active,
    last_seen_at
  ) VALUES (
    v_user_id,
    p_provider,
    p_push_token,
    p_platform,
    p_app_kind,
    p_device_name,
    p_device_fingerprint,
    p_app_version,
    true,
    now()
  );
END;
$$;

-- Apenas usuários autenticados podem chamar esta função.
REVOKE ALL ON FUNCTION upsert_notification_device(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_notification_device(text, text, text, text, text, text, text) TO authenticated;
