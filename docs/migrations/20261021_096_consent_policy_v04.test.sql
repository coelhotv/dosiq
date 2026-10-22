-- Spec 096 B2 — prova da migração 20261021_096_consent_policy_v04.sql (T038: PO-9 banco, PO-SEC-1,
-- PO-12 trilha). Roda DEPOIS do corpo da migração (sem BEGIN/COMMIT), no MESMO script, e termina com
-- RAISE EXCEPTION 'RESULT …' — o erro final desfaz tudo. Asserção que falha levanta antes.

-- ─── 1. Privilégios em consent_policy (PO-SEC-1) ───────────────────────────────────────────
DO $$
DECLARE r text; p text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF NOT has_table_privilege(r, 'public.consent_policy', 'SELECT') THEN RAISE EXCEPTION 'PO-SEC-1: % perdeu SELECT', r; END IF;
    FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege(r, 'public.consent_policy', p) THEN RAISE EXCEPTION 'PO-SEC-1: % tem %', r, p; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT version FROM public.consent_policy WHERE id = 1) <> '0.4' THEN RAISE EXCEPTION 'PO-9: versão ≠ 0.4'; END IF;
END $$;

-- ─── 2. Semente: titular de teste (user_settings nasce pelo gatilho de auth.users) ─────────
INSERT INTO auth.users (id, email, created_at) VALUES
  ('09600000-0000-0000-0000-00000000000a', 't096-a@dosiq.test', now());

SELECT set_config('request.jwt.claims', '{"sub":"09600000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '09600000-0000-0000-0000-00000000000a', true);

-- ─── 3. Como o titular (authenticated): os 3 tipos gravam linha 0.4; B liga/desliga o flag ──
SET LOCAL ROLE authenticated;
SELECT public.consent_grant('health_data', 'web');
SELECT public.consent_grant('terms_privacy', 'web');
SELECT public.consent_grant('international_transfer', 'web');
RESET ROLE;

DO $$
DECLARE v_n int; v_flag timestamptz; v_rev timestamptz;
BEGIN
  SELECT count(*) INTO v_n FROM public.consent_log
   WHERE user_id = '09600000-0000-0000-0000-00000000000a' AND action = 'granted' AND policy_version = '0.4';
  IF v_n <> 3 THEN RAISE EXCEPTION 'PO-12: esperava 3 granted 0.4, veio %', v_n; END IF;
  SELECT international_transfer_granted_at, consent_revoked_at INTO v_flag, v_rev FROM public.user_settings
   WHERE user_id = '09600000-0000-0000-0000-00000000000a';
  IF v_flag IS NULL THEN RAISE EXCEPTION 'grant B não ligou o flag'; END IF;
  IF v_rev IS NOT NULL THEN RAISE EXCEPTION 'grant B/A mexeu no flag de A'; END IF;
END $$;

-- revoke de A não mexe no flag de B
SET LOCAL ROLE authenticated;
SELECT public.consent_revoke('health_data', 'web');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT international_transfer_granted_at FROM public.user_settings WHERE user_id = '09600000-0000-0000-0000-00000000000a') IS NULL THEN
    RAISE EXCEPTION 'revoke de A desligou B';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT public.consent_revoke('international_transfer', 'web');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT international_transfer_granted_at FROM public.user_settings WHERE user_id = '09600000-0000-0000-0000-00000000000a') IS NOT NULL THEN
    RAISE EXCEPTION 'revoke B não desligou o flag';
  END IF;
END $$;

-- ─── 4. Guard: authenticated não escreve o flag direto ──────────────────────────────────────
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    UPDATE public.user_settings SET international_transfer_granted_at = now()
     WHERE user_id = '09600000-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'GUARD FALHOU: UPDATE direto passou';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'international_transfer_granted_at_is_controller_owned' THEN RAISE; END IF;
  END;
  -- outra coluna segue editável
  UPDATE public.user_settings SET quiet_hours_enabled = quiet_hours_enabled
   WHERE user_id = '09600000-0000-0000-0000-00000000000a';
END $$;
RESET ROLE;

-- ─── 5. Tipo inválido segue recusado ────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.consent_grant('ai_transfer', 'web');
    RAISE EXCEPTION 'tipo inválido passou';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'consent_type_invalid' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$ BEGIN RAISE EXCEPTION 'RESULT 096-B2: todas as asserções passaram'; END $$;
