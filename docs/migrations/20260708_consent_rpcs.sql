-- 20260708_consent_rpcs.sql — 046 Slice A / T001a + T001c
-- Escrita da trilha de consentimento: pepper, derivação do subject_hash e as RPCs do titular.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- POR QUE ESTE ARQUIVO EXISTE (F1/F2)
-- ─────────────────────────────────────────────────────────────────────────────
-- Se `authenticated` pudesse dar INSERT em consent_log, a trilha seria forjável PELO PRÓPRIO
-- AUDITADO. Então a escrita é exclusivamente por estas funções SECURITY DEFINER, que:
--   · derivam `user_id` de auth.uid() — o client não escolhe de quem é o evento;
--   · carimbam `policy_version` da tabela consent_policy — o client não escolhe qual versão aceitou;
--   · carimbam `subject_hash` do e-mail em auth.users — o client nunca vê o pepper;
--   · só aceitam action ∈ {granted, revoked} — `account_deleted` não é fabricável pelo titular.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- T001c — O PEPPER (S3/S5)
-- ─────────────────────────────────────────────────────────────────────────────
-- MORA NO VAULT. **NÃO EXISTE FALLBACK POR GUC** — e essa é uma correção do plano, não um
-- esquecimento. O S3 admitia `app.consent_pepper` como "fallback documentado"; o script de
-- ataque (20260708_consent_log.test.sql, caso 16) DERRUBOU essa ideia: com o pepper em GUC,
-- um `authenticated` qualquer lê a chave com um `SELECT current_setting('app.consent_pepper')`.
-- GUC não tem ACL — é legível por qualquer role e aparece em `pg_settings`.
--
-- Um fallback assim é pior do que não ter fallback: ele só entra em cena quando o Vault falha,
-- ou seja, degradaria SILENCIOSAMENTE de "pepper secreto" para "pepper público" — e todo
-- `subject_hash` viraria reversível por dicionário (e-mail tem entropia baixíssima).
-- Vault ausente ⇒ `RAISE`. A exclusão ABORTA e a conta NÃO é apagada. É o failure mode correto:
-- melhor não apagar do que apagar deixando um recibo que qualquer um consegue reidentificar.
--
-- O VALOR NÃO ESTÁ NESTE ARQUIVO e não está no repo. É provisionado UMA VEZ, fora da migração:
--     SELECT vault.create_secret(
--       encode(extensions.gen_random_bytes(32), 'hex'),
--       'CONSENT_HASH_PEPPER',
--       'Pepper do HMAC de subject_hash (046). NÃO RODA — rodar invalida a trilha inteira.'
--     );
-- (a função devolve o id do segredo, nunca o valor). O pepper NÃO RODA: rotacioná-lo tornaria
-- todos os hashes antigos inverificáveis, ou seja, destruiria a prova.
--
-- ⚠️ SILÊNCIO É O PIOR MODO DE FALHA AQUI: pepper ausente faria `hmac(email, '')` — um HMAC
-- perfeitamente válido, com chave vazia, IGUAL PARA TODOS os titulares, e nenhum teste falharia.
-- Por isso `RAISE EXCEPTION` (não fallback, não default) quando ausente ou vazio.
--
-- ⚠️ S5 — `pgcrypto` vive no schema `extensions` (verificado em prod via MCP) e estas funções
-- rodam com `search_path = ''`. `hmac(...)` NÃO resolve; tem que ser `extensions.hmac(...)`.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. consent_pepper() — leitor do segredo. PRIVADA.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consent_pepper()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pepper text;
BEGIN
  SELECT s.decrypted_secret INTO v_pepper
  FROM vault.decrypted_secrets s
  WHERE s.name = 'CONSENT_HASH_PEPPER'
  LIMIT 1;

  -- Sem fallback. Falhar alto. Nunca degradar para HMAC de chave vazia (hash idêntico p/ todos
  -- os titulares, sem nenhum teste falhando) nem para pepper em GUC (legível por authenticated).
  IF v_pepper IS NULL OR length(trim(v_pepper)) = 0 THEN
    RAISE EXCEPTION 'consent_pepper_missing'
      USING HINT = 'Provisione o segredo CONSENT_HASH_PEPPER no Vault (ver cabeçalho da migração).';
  END IF;

  RETURN v_pepper;
END;
$$;

-- Ninguém chama isto de fora. As DEFINER abaixo são owned por postgres e alcançam a função pelo
-- privilégio do OWNER — não precisam (nem devem) de GRANT para role alguma.
REVOKE ALL ON FUNCTION public.consent_pepper() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consent_pepper() FROM anon;
REVOKE ALL ON FUNCTION public.consent_pepper() FROM authenticated;
REVOKE ALL ON FUNCTION public.consent_pepper() FROM service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. consent_subject_hash(email) — a derivação. PRIVADA.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consent_subject_hash(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'consent_subject_email_missing';
  END IF;

  -- S5: `extensions.` obrigatório sob search_path = ''.
  RETURN encode(
    extensions.hmac(v_email, public.consent_pepper(), 'sha256'),
    'hex'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consent_subject_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consent_subject_hash(text) FROM anon;
REVOKE ALL ON FUNCTION public.consent_subject_hash(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.consent_subject_hash(text) FROM service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. consent_write() — núcleo compartilhado de granted/revoked. PRIVADA.
-- ─────────────────────────────────────────────────────────────────────────────
-- Anti-flood (S6): se o ÚLTIMO evento do mesmo consent_type já tem a mesma ação e foi gravado há
-- menos de 10s, é no-op idempotente — devolve o id existente. Cobre o duplo-clique e o flood da
-- trilha. O freio TEM que ser na escrita: append-only impede limpar depois.
CREATE OR REPLACE FUNCTION public.consent_write(
  p_action       text,
  p_consent_type text,
  p_platform     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_email          text;
  v_policy_version text;
  v_last_id        uuid;
  v_id             uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- O titular só produz estas duas ações. As do controlador (notice_sent/pruned/account_deleted)
  -- não têm caminho de escrita a partir de uma sessão autenticada — nem por engano de parâmetro.
  IF p_action NOT IN ('granted', 'revoked') THEN
    RAISE EXCEPTION 'consent_action_not_allowed';
  END IF;

  -- CHECKs da tabela cobrem estes dois, mas falhar aqui dá erro nomeado em vez de violação de
  -- constraint vazando nome de constraint pro client.
  IF p_consent_type NOT IN ('health_data', 'terms_privacy') THEN
    RAISE EXCEPTION 'consent_type_invalid';
  END IF;
  IF p_platform NOT IN ('web', 'mobile', 'server') THEN
    RAISE EXCEPTION 'consent_platform_invalid';
  END IF;

  -- Anti-flood: olha o ÚLTIMO evento daquele tipo, não "existe algum".
  SELECT c.id INTO v_last_id
  FROM public.consent_log c
  WHERE c.user_id = v_uid
    AND c.consent_type = p_consent_type
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_last_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.consent_log c
    WHERE c.id = v_last_id
      AND c.action = p_action
      AND c.created_at > now() - interval '10 seconds'
  ) THEN
    RETURN v_last_id; -- no-op idempotente
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'consent_subject_email_missing';
  END IF;

  -- Versão carimbada NO SERVIDOR. O client não opina sobre o que ele aceitou.
  SELECT p.version INTO v_policy_version FROM public.consent_policy p WHERE p.id = 1;
  IF v_policy_version IS NULL THEN
    RAISE EXCEPTION 'consent_policy_version_missing';
  END IF;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (
    v_uid,
    public.consent_subject_hash(v_email),
    p_consent_type,
    p_action,
    v_policy_version,
    p_platform
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consent_write(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consent_write(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.consent_write(text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.consent_write(text, text, text) FROM service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. As duas RPCs públicas do titular
-- ─────────────────────────────────────────────────────────────────────────────
-- Assinatura sem `p_action`: a ação está no NOME da função. Não existe parâmetro por onde
-- empurrar 'account_deleted'.
CREATE OR REPLACE FUNCTION public.consent_grant(
  p_consent_type text,
  p_platform     text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.consent_write('granted', p_consent_type, p_platform);
$$;

CREATE OR REPLACE FUNCTION public.consent_revoke(
  p_consent_type text,
  p_platform     text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.consent_write('revoked', p_consent_type, p_platform);
$$;

-- REVOKE FROM PUBLIC ANTES do GRANT — o default do Postgres é EXECUTE para PUBLIC (CLAUDE.md).
REVOKE EXECUTE ON FUNCTION public.consent_grant(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consent_grant(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consent_revoke(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consent_revoke(text, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.consent_grant(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consent_revoke(text, text) TO authenticated, service_role;
