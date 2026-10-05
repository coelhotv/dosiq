-- 20261005_095_install_id_device_attribution.sql — spec 095 · ADR-108 (emenda ADR-089)
-- Trava da cadência (085) julgava a conta por linhas de aparelho que não eram dela.
--
-- PROBLEMA (verificado em prod via MCP 2026-09-30 e 2026-10-05):
--   C-1 `device_activity` é única por (conta, fingerprint {os, osVersion, modelo}): dois apps dosiq no
--       mesmo aparelho escrevem a MESMA linha, vale a versão de quem gravou por último.
--   C-2 Nada aposenta a linha quando outra conta assume a instalação ou a pessoa sai.
--   C-5 Token reinstalado por cima fica `is_active=true` para sempre (escapa do ON CONFLICT).
--
-- O QUE MUDA:
--   1. `install_id uuid` (aleatório, gerado no app, gira por sessão) nas duas tabelas.
--   2. UNIQUE vira 2 índices parciais: legado (user, fp) WHERE id NULL · novo (user, id) WHERE id NOT NULL.
--   3. `upsert_device_activity` (+p_install_id DEFAULT NULL): com id, atualiza a linha da instalação;
--      senão ADOTA a linha legada (FR-010, exceção do INV-1 aceita — C1.5 K-4); senão insere.
--   4. `upsert_notification_device` (+p_install_id DEFAULT NULL):
--      FR-001 — token de push mudando de dono = prova de que AQUELA instalação saiu da conta anterior:
--               apaga a linha legada do dono anterior com o fingerprint E a versão do token.
--      FR-009 — token novo desativa os tokens ativos anteriores da mesma conta/canal/instalação
--               (por id; fallback por fingerprint SÓ em linhas sem id). Só expo e apns_liveactivity.
--   5. `delete_device_activity(p_install_id)` — logout apaga a linha da instalação (FR-006).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                    | Análise / mitigação                                  |
-- |-----------------------------------------|------------------------------------------------------|
-- | p_install_id NULL (app ≤ 0.33.x)        | caminho legado idêntico ao atual (ON CONFLICT parcial). |
-- | p_install_id não-uuid / 10 kB           | tipo uuid ⇒ 22P02 antes do corpo; nada gravado (S-5). |
-- | id de OUTRA conta                       | toda leitura/escrita filtra user_id = auth.uid() (S-5/S-6). |
-- | auth.uid() NULL                         | RAISE 'not authenticated' (inalterado).               |
-- | app_version NULL no token antigo        | comparação IS NOT DISTINCT FROM.                     |
-- | token muda de dono e a linha tem outra versão | não apaga (prova não bate — edge case da spec).  |
-- | dono anterior == auth.uid()             | não apaga nada.                                       |
-- | registro concorrente do mesmo token     | SELECT … FOR UPDATE serializa (E-5).                 |
-- | 2 heartbeats concorrentes, mesma instalação | 2º cai no ON CONFLICT (user, install_id).        |
-- | adoção concorrente                      | lock da linha re-avalia WHERE install_id IS NULL ⇒ 2º vai ao ON CONFLICT. |
-- | chamada com assinatura antiga (3 / 7 / 8 params) | DEFAULT NULL; DROP antes do CREATE ⇒ sem sobrecarga (E-3). |
-- | DROP+CREATE reabre EXECUTE p/ PUBLIC    | REVOKE FROM PUBLIC, anon antes do GRANT (S-3, AP-275). |
-- | search_path hijack                      | SET search_path = '' + nomes qualificados (as 3).    |
-- | webpush                                 | sem device_activity (CHECK ios/android); FR-001/009 restritos a expo/apns_liveactivity. |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Reversível (dados de install_id se perdem; nenhum outro dado é alterado):
--   DROP FUNCTION public.delete_device_activity(uuid);
--   DROP FUNCTION public.upsert_device_activity(text, text, text, uuid);
--   DROP FUNCTION public.upsert_notification_device(text, text, text, text, text, text, text, boolean, uuid);
--   recriar as duas versões anteriores (pg_get_functiondef de 2026-10-05, ver analysis-A.md) + grants;
--   DELETE de duplicatas (user_id, device_fingerprint) em device_activity; DROP INDEX dos dois parciais;
--   ALTER TABLE device_activity ADD CONSTRAINT device_activity_user_id_device_fingerprint_key UNIQUE (user_id, device_fingerprint);
--   ALTER TABLE … DROP COLUMN install_id (duas tabelas).
-- Aplicado via Supabase MCP (apply_migration) após dry-run BEGIN..ROLLBACK (.test.sql).

-- ─── 1. colunas ───────────────────────────────────────────────────────────────
ALTER TABLE public.device_activity ADD COLUMN install_id uuid;
ALTER TABLE public.notification_devices ADD COLUMN install_id uuid;

-- ─── 2. unicidade por instalação (E-1) ─────────────────────────────────────────
ALTER TABLE public.device_activity DROP CONSTRAINT device_activity_user_id_device_fingerprint_key;
CREATE UNIQUE INDEX device_activity_legacy_fp_key
  ON public.device_activity (user_id, device_fingerprint) WHERE install_id IS NULL;
CREATE UNIQUE INDEX device_activity_install_key
  ON public.device_activity (user_id, install_id) WHERE install_id IS NOT NULL;

-- ─── 3. heartbeat ─────────────────────────────────────────────────────────────
DROP FUNCTION public.upsert_device_activity(text, text, text);

CREATE FUNCTION public.upsert_device_activity(
  p_device_fingerprint text,
  p_platform text,
  p_app_version text,
  p_install_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_install_id IS NULL THEN
    -- App sem identificador (≤ 0.33.x): comportamento anterior, linha por fingerprint.
    INSERT INTO public.device_activity (user_id, device_fingerprint, platform, app_version, last_seen_at)
    VALUES (v_user_id, p_device_fingerprint, p_platform, p_app_version, now())
    ON CONFLICT (user_id, device_fingerprint) WHERE install_id IS NULL DO UPDATE SET
      platform     = EXCLUDED.platform,
      app_version  = EXCLUDED.app_version,
      last_seen_at = now();
    RETURN;
  END IF;

  -- Linha da instalação (atualizar o SO muda o fingerprint, não a linha — C-4).
  UPDATE public.device_activity SET
    device_fingerprint = p_device_fingerprint,
    platform           = p_platform,
    app_version        = p_app_version,
    last_seen_at       = now()
  WHERE user_id = v_user_id AND install_id = p_install_id;
  IF FOUND THEN RETURN; END IF;

  -- FR-010: adota a linha legada da mesma conta e aparelho (quem atualiza da loja não fica travado
  -- pela própria linha antiga). Exceção do INV-1 aceita pelo PO (C1.5 K-4).
  UPDATE public.device_activity SET
    install_id   = p_install_id,
    platform     = p_platform,
    app_version  = p_app_version,
    last_seen_at = now()
  WHERE user_id = v_user_id AND device_fingerprint = p_device_fingerprint AND install_id IS NULL;
  IF FOUND THEN RETURN; END IF;

  INSERT INTO public.device_activity (user_id, device_fingerprint, platform, app_version, last_seen_at, install_id)
  VALUES (v_user_id, p_device_fingerprint, p_platform, p_app_version, now(), p_install_id)
  ON CONFLICT (user_id, install_id) WHERE install_id IS NOT NULL DO UPDATE SET
    device_fingerprint = EXCLUDED.device_fingerprint,
    platform           = EXCLUDED.platform,
    app_version        = EXCLUDED.app_version,
    last_seen_at       = now();
END;
$function$;

-- ─── 4. registro de push ──────────────────────────────────────────────────────
DROP FUNCTION public.upsert_notification_device(text, text, text, text, text, text, text, boolean);

CREATE FUNCTION public.upsert_notification_device(
  p_provider text,
  p_push_token text,
  p_platform text,
  p_app_kind text,
  p_device_name text,
  p_device_fingerprint text,
  p_app_version text,
  p_native_alarm_enabled boolean DEFAULT false,
  p_install_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_prev_user uuid;
  v_prev_fp text;
  v_prev_version text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- E-5: lê dono/fingerprint/versão ANTES do ON CONFLICT sobrescrever; trava o token.
  SELECT nd.user_id, nd.device_fingerprint, nd.app_version
    INTO v_prev_user, v_prev_fp, v_prev_version
    FROM public.notification_devices nd
   WHERE nd.provider = p_provider AND nd.push_token = p_push_token
   FOR UPDATE;

  -- FR-001: o token mudou de dono ⇒ aquela instalação saiu da conta anterior. Apaga SÓ a linha
  -- legada com o fingerprint e a versão do token (S-1). Linha com install_id é do build novo,
  -- que apaga a própria no logout (FR-006).
  IF p_provider IN ('expo', 'apns_liveactivity')
     AND v_prev_user IS NOT NULL AND v_prev_user <> v_user_id AND v_prev_fp IS NOT NULL THEN
    DELETE FROM public.device_activity da
     WHERE da.user_id = v_prev_user
       AND da.device_fingerprint = v_prev_fp
       AND da.app_version IS NOT DISTINCT FROM v_prev_version
       AND da.install_id IS NULL;
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
    install_id,
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
    p_install_id,
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
    install_id           = EXCLUDED.install_id,
    is_active            = true,
    last_seen_at         = now(),
    updated_at           = now();

  -- FR-009 (C-5): token reinstalado por cima deixa o anterior ativo. Desativa os outros tokens
  -- ativos desta conta e canal na mesma instalação; o fallback por fingerprint só alcança linhas
  -- sem id (PO-SEC-4). Risco S-2 aceito pelo PO: app antigo reativa o próprio token ao registrar.
  IF p_provider IN ('expo', 'apns_liveactivity') THEN
    UPDATE public.notification_devices nd SET
      is_active  = false,
      updated_at = now()
    WHERE nd.user_id = v_user_id
      AND nd.provider = p_provider
      AND nd.push_token <> p_push_token
      AND nd.is_active
      AND (
        (p_install_id IS NOT NULL AND nd.install_id = p_install_id)
        OR (nd.install_id IS NULL AND nd.device_fingerprint = p_device_fingerprint)
      );
  END IF;
END;
$function$;

-- ─── 5. logout ────────────────────────────────────────────────────────────────
CREATE FUNCTION public.delete_device_activity(p_install_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.device_activity
   WHERE user_id = v_user_id AND install_id = p_install_id;
END;
$function$;

-- ─── 6. grants (S-3 / AP-275) ─────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.upsert_device_activity(text, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_notification_device(text, text, text, text, text, text, text, boolean, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_device_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_device_activity(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_notification_device(text, text, text, text, text, text, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_device_activity(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
