-- 2026-04-15: RPC para gerar token de vinculação Telegram de forma segura
-- H5.7 Sprint H5 Decision (Option A: Supabase RPC)

CREATE OR REPLACE FUNCTION generate_telegram_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token text;
BEGIN
  -- Gerar token alfanumérico aleatório de 6 dígitos
  new_token := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  
  -- Upsert nas configurações do usuário logado (auth.uid())
  INSERT INTO public.user_settings (user_id, verification_token, updated_at)
  VALUES (auth.uid(), new_token, now())
  ON CONFLICT (user_id) DO UPDATE
  SET verification_token = EXCLUDED.verification_token,
      updated_at = EXCLUDED.updated_at;
      
  RETURN new_token;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION generate_telegram_token() TO authenticated;
