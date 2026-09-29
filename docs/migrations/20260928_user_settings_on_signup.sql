-- 20260928_user_settings_on_signup.sql — spec 090 D-1 · ADR-104
-- Toda conta nova nasce com a linha de `user_settings`, sem depender do app.
--
-- PROBLEMA (verificado em prod via MCP 2026-09-27/28):
--   Nenhum trigger em auth.users. A linha só nascia na `consent_write` (046) ou no upsert do perfil.
--   Entre o signup e o consentimento a conta ficava sem linha; o app lia com `.single()` e condição
--   invertida ⇒ bridges de alarme abortavam e (pós-091) o Hoje mostrava tela de erro. O conserto no
--   cliente (maybeSingle) não alcança a frota em versão antiga — por isso o trigger.
--   SEM backfill: as 9 contas sem linha estão paradas (RC-SEC S1, decisão do PO 27/09).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                  | Análise / mitigação                                      |
-- |---------------------------------------|----------------------------------------------------------|
-- | Linha já existe (race c/ consent_write)| ON CONFLICT (user_id) DO NOTHING — UNIQUE user_settings_user_id_key verificado. |
-- | Insert falha (qualquer motivo)        | EXCEPTION WHEN OTHERS → RETURN NEW: cadastro NUNCA cai (INV-4). |
-- | Colunas NOT NULL                      | Só user_id sem default (information_schema 28/09); demais têm default. |
-- | consent_revoked_at                    | Nunca escrito (fica NULL); trg_user_settings_consent_flag_ins passa. |
-- | Chamada direta por anon/authenticated | REVOKE EXECUTE de PUBLIC/anon/authenticated (PO-SEC-1). Trigger não exige EXECUTE no disparo. |
-- | search_path hijack                    | SET search_path = '' + nomes qualificados.                |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Reversível: DROP TRIGGER on_auth_user_created_settings ON auth.users; DROP FUNCTION public.handle_new_user_settings();
-- Aplicado via Supabase MCP (apply_migration) após dry-run BEGIN..ROLLBACK.

CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- INV-4: a configuração é conveniência; o cadastro é o que não pode falhar.
  RAISE WARNING 'handle_new_user_settings falhou para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_settings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();
