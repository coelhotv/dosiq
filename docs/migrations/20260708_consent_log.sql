-- 20260708_consent_log.sql — 046 Slice A / T001 (trilha probatória de consentimento LGPD)
--
-- PROPÓSITO: registrar, de forma AUDITÁVEL e NÃO-FORJÁVEL, o consentimento específico e
-- destacado para tratamento de dado de saúde (LGPD art. 11) — e o RECIBO da exclusão de conta.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- AS DUAS DECISÕES QUE EXPLICAM TODO O RESTO DO ARQUIVO
-- ─────────────────────────────────────────────────────────────────────────────
-- 1) A TRILHA SOBREVIVE AO TITULAR (FR-011..FR-014).
--    `user_id` é NULLABLE com FK `ON DELETE SET NULL` — NUNCA cascade. Uma trilha que
--    cascateia é uma testemunha que morre junto com o fato: excluída a conta, o controlador
--    não teria como provar que houve consentimento nem que a exclusão foi executada.
--    Assimetria deliberada com o T000 (dose_instances/dose_critical_events/dose_adherence_monthly
--    são CASCADE): o dado CLÍNICO do titular tem que sumir (art. 16); a PROVA DA BASE LEGAL, não.
--
--    Após o DELETE do titular a linha fica órfã (`user_id NULL`) e só o `subject_hash` a liga a
--    uma pessoa. O hash é HMAC-SHA256(lower(trim(email)), pepper) e NÃO é reversível DE PROPÓSITO:
--    o fluxo jurídico é VERIFICAR (o requerimento NOMEIA o titular → recalcula-se o HMAC → acha-se
--    as linhas), não LISTAR excluídos — listar exigiria guardar o e-mail, isto é, não excluir.
--
-- 2) ESCRITA NUNCA VEM DO CLIENT (F1). `authenticated` tem SELECT — e só.
--    Dar INSERT ao dono tornaria a trilha forjável PELO PRÓPRIO AUDITADO: `granted` retroativo,
--    `policy_version` falsa, `account_deleted` fabricado. Valor probatório iria a zero e a US2
--    seria anulada. Append-only protege contra UPDATE/DELETE — NÃO contra INSERT forjado.
--    Escrita = RPCs SECURITY DEFINER (20260708_consent_rpcs.sql) + `service_role`.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                    | Análise / mitigação                                  |
-- |-----------------------------------------|------------------------------------------------------|
-- | user_id NULL na escrita                 | Só o SET NULL da FK produz NULL. As RPCs derivam de auth.uid() e RAISE 'not_authenticated' se nulo. Linha órfã é ESTADO FINAL esperado, não entrada. |
-- | Titular excluído → linha órfã           | RLS `user_id = auth.uid()` NUNCA casa com NULL (SQL tri-valorado: NULL = NULL é NULL, não true). Órfã fica invisível a `authenticated` e legível só por `service_role`. É o comportamento desejado: a linha passa a ser do CONTROLADOR. |
-- | subject_hash ausente/vazio              | NOT NULL + CHECK de 64 hex. Pepper ausente faz a RPC abortar ANTES do insert (RAISE no consent_subject_hash) — jamais grava HMAC de string vazia (que seria idêntico p/ todos). |
-- | Evento duplicado (duplo-clique)         | Anti-flood S6 na RPC (no-op idempotente < 10s). Append-only impede limpar depois, então o freio tem que ser na escrita. |
-- | Tipo/ação/plataforma fora do domínio    | CHECKs R-271. Valor novo exige migração — nada de string livre numa trilha probatória. |
-- | policy_version ausente em granted/revoked | CHECK condicional: consentimento SEM versão é inauditável (aceitou o quê?). Já `account_deleted`/`notice_sent`/`pruned` PODEM ter NULL (titular que nunca consentiu). |
-- | authenticated lendo subject_hash        | Fora do GRANT de coluna (S4). Expor o hash criaria oráculo gratuito de pares e-mail↔hash e não serve a nenhum caso de uso do titular. |
-- | Backfill de contas existentes           | NÃO há. Trilha começa vazia; quem não tem evento fica `missing` e cai no prompt do Slice B. Inventar consentimento retroativo seria exatamente a fraude que a tabela existe pra impedir. |
-- | Migração re-executada                   | IF NOT EXISTS / DROP POLICY IF EXISTS em tudo. Idempotente. |
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. consent_policy — versão vigente da política, DO LADO DO BANCO
-- ─────────────────────────────────────────────────────────────────────────────
-- Por que uma tabela: as RPCs carimbam `policy_version` NO SERVIDOR (F1 — versão vinda do
-- client é forjável). Mas o banco não lê TypeScript, e o valor canônico vive em @dosiq/core.
-- Esta tabela é o espelho do canônico dentro do Postgres; T019b sincroniza os TRÊS lugares
-- (constante do core = versão impressa no HTML = esta linha). Divergiu, a trilha registra o
-- aceite de uma versão que ninguém consegue exibir — e o consentimento volta a ser inauditável.
CREATE TABLE IF NOT EXISTS public.consent_policy (
  id         smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- linha única
  version    text NOT NULL CHECK (length(trim(version)) > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Versão vigente hoje: 0.2 (apps/web/public/politica-de-privacidade.html — "Versão do documento: 0.2").
INSERT INTO public.consent_policy (id, version) VALUES (1, '0.2')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.consent_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_policy_select_all ON public.consent_policy;
CREATE POLICY consent_policy_select_all ON public.consent_policy
  FOR SELECT TO authenticated, anon USING (true); -- a versão publicada é pública por definição

REVOKE ALL ON public.consent_policy FROM PUBLIC;
GRANT SELECT ON public.consent_policy TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_policy TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. consent_log — a trilha
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULLABLE + SET NULL: ver decisão (1) no cabeçalho. Não trocar por CASCADE sem reler FR-011.
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Único elo que sobrevive à exclusão. HMAC-SHA256 hex (64 chars), derivado SEMPRE no servidor.
  subject_hash   text NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),

  consent_type   text NOT NULL CHECK (consent_type IN ('health_data', 'terms_privacy')),

  -- granted/revoked = atos do TITULAR (via RPC DEFINER).
  -- notice_sent/pruned/account_deleted = atos do CONTROLADOR (service_role / DEFINER).
  action         text NOT NULL CHECK (
                   action IN ('granted', 'revoked', 'notice_sent', 'pruned', 'account_deleted')
                 ),

  -- NULL só é aceitável nos atos do controlador (titular que nunca consentiu). Um `granted`
  -- sem versão não prova nada — aceitou o quê?
  policy_version text CHECK (policy_version IS NULL OR length(trim(policy_version)) > 0),

  platform       text NOT NULL CHECK (platform IN ('web', 'mobile', 'server')),
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT consent_log_consent_requires_version CHECK (
    action NOT IN ('granted', 'revoked') OR policy_version IS NOT NULL
  )
);

COMMENT ON TABLE public.consent_log IS
  'Trilha probatória de consentimento LGPD (046). Append-only. SOBREVIVE à exclusão do titular '
  '(user_id ON DELETE SET NULL); subject_hash (HMAC do e-mail) é o único elo remanescente. '
  'Escrita SOMENTE via RPC SECURITY DEFINER ou service_role — authenticated tem SELECT e mais nada.';
COMMENT ON COLUMN public.consent_log.subject_hash IS
  'HMAC-SHA256(lower(trim(email)), CONSENT_HASH_PEPPER) em hex. Irreversível de propósito: serve '
  'para VERIFICAR um titular nomeado num requerimento, nunca para listar excluídos.';

-- Estado derivado = último evento por tipo (o consentService ordena por created_at desc).
CREATE INDEX IF NOT EXISTS idx_consent_log_user_type_created
  ON public.consent_log (user_id, consent_type, created_at DESC);

-- É ESTE índice que torna o requerimento judicial consultável depois que a conta já não existe.
CREATE INDEX IF NOT EXISTS idx_consent_log_subject_hash
  ON public.consent_log (subject_hash);

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

-- SELECT do próprio. Sem policy de INSERT/UPDATE/DELETE — append-only para o titular, e nem
-- append ele consegue: o GRANT abaixo não lhe dá INSERT.
DROP POLICY IF EXISTS consent_log_select_own ON public.consent_log;
CREATE POLICY consent_log_select_own ON public.consent_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- GRANTS — o coração do F1/S4.
REVOKE ALL ON public.consent_log FROM PUBLIC;
REVOKE ALL ON public.consent_log FROM anon;       -- anon não enxerga trilha de ninguém
REVOKE ALL ON public.consent_log FROM authenticated;

-- S4 — GRANT DE COLUNA: `subject_hash` e `user_id` ficam DE FORA.
-- Consequência prática (documentada no consentService): o client NÃO pode filtrar por user_id —
-- o Postgres exige privilégio de SELECT também nas colunas usadas no WHERE. Quem escopa a leitura
-- é a RLS, não o filtro. `.eq('user_id', ...)` daria permission denied.
GRANT SELECT (id, consent_type, action, policy_version, platform, created_at)
  ON public.consent_log TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_log TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. user_settings — contador do prompt de consentimento (consumido no Slice B)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS consent_prompt_sessions      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consent_prompt_last_seen_at  timestamptz;

COMMENT ON COLUMN public.user_settings.consent_prompt_sessions IS
  'Sessões em que o prompt de consentimento foi exibido sem decisão (Slice B). Sessão = bootstrap '
  'com gap > 30min desde consent_prompt_last_seen_at. Na 4ª, o prompt vira bloqueante.';
