-- Flag por-device "alarme nativo ligado" (Spec 001 — A2 / gate de duplicata).
--
-- Problema: com o alarme nativo (Notifee) ligado no mobile, a dose dispara DUAS
-- vezes — o alarme local + o push remoto de lembrete de dose. Em background o iOS
-- exibe o push automaticamente, então não dá pra deduplicar no client.
--
-- Solução: o device marca este flag ao ligar o alarme; o canal expo (server) PULA
-- o push de lembrete de DOSE pra devices com o flag. Outros tipos (estoque etc.) e
-- outros canais (web/telegram) seguem normais — gate por-device + só-dose.

ALTER TABLE public.notification_devices
  ADD COLUMN IF NOT EXISTS native_alarm_enabled boolean NOT NULL DEFAULT false;

-- RPC estendida com p_native_alarm_enabled (DEFAULT false p/ callers antigos de 7
-- args — web/pwa — continuarem válidos sem ambiguidade). DROP da assinatura antiga
-- antes de recriar com 8 args evita overload duplicado ("function is not unique").
DROP FUNCTION IF EXISTS upsert_notification_device(text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION upsert_notification_device(
  p_provider            text,
  p_push_token          text,
  p_platform            text,
  p_app_kind            text,
  p_device_name         text,
  p_device_fingerprint  text,
  p_app_version         text,
  p_native_alarm_enabled boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.notification_devices (
    user_id,
    provider,
    push_token,
    platform,
    app_kind,
    device_name,
    device_fingerprint,
    app_version,
    native_alarm_enabled,
    is_active,
    last_seen_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_provider,
    p_push_token,
    p_platform,
    p_app_kind,
    p_device_name,
    p_device_fingerprint,
    p_app_version,
    p_native_alarm_enabled,
    true,
    now(),
    now()
  )
  ON CONFLICT (provider, push_token) DO UPDATE SET
    user_id              = EXCLUDED.user_id,
    platform             = EXCLUDED.platform,
    app_kind             = EXCLUDED.app_kind,
    device_name          = EXCLUDED.device_name,
    device_fingerprint   = EXCLUDED.device_fingerprint,
    app_version          = EXCLUDED.app_version,
    native_alarm_enabled = EXCLUDED.native_alarm_enabled,
    is_active            = true,
    last_seen_at         = now(),
    updated_at           = now();
END;
$$;

-- Apenas autenticados (nunca anon — RPC privilegiada SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION upsert_notification_device(text, text, text, text, text, text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION upsert_notification_device(text, text, text, text, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION upsert_notification_device(text, text, text, text, text, text, text, boolean) TO authenticated;
