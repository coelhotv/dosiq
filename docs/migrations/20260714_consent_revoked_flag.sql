-- 20260714_consent_revoked_flag.sql — spec 046 Slice B (T014, revisão pós-review do PO)
--
-- PROBLEMA QUE ESTA MIGRAÇÃO RESOLVE
-- ─────────────────────────────────────────────────────────────────────────────
-- A 1ª versão do T014 lia a trilha (`consent_log`) UMA vez por run do cron e montava um Set de
-- revogados em memória. Isso criou uma DEPENDÊNCIA GLOBAL NOVA para resolver um estado que é POR
-- USUÁRIO: se aquele único SELECT falhasse, o run inteiro abortava e NINGUÉM recebia lembrete de
-- dose naquele minuto. A situação de um titular (revogado) passava a poder suprimir a necessidade
-- clínica de todos os outros pacientes. Inaceitável — e desnecessário.
--
-- SOLUÇÃO: materializar o estado revogado como COLUNA em `user_settings`, escrita pela MESMA
-- transação que grava a trilha. O pipeline de notificação já lê `user_settings` por usuário
-- (`getSettingsByUserId`) — o flag entra nesse fetch. Zero query nova, zero ponto de falha novo,
-- zero fetch global. Falha de leitura passa a ser um problema DO usuário afetado (que já não seria
-- processado de qualquer forma: sem `user_settings` o job não sabe nem o fuso dele).
--
-- ⚠️ NÃO são duas fontes de verdade. `consent_log` continua sendo a PROVA (append-only, auditável,
-- sobrevive ao titular). A coluna é um índice operacional derivado dela, com UM ÚNICO ESCRITOR
-- (`public.consent_write`) e gravado na MESMA txn do evento — não há janela para divergir.
--
-- R-270 PREFLIGHT — failure modes considerados:
--   1. Coluna NULL / linha ausente em user_settings ⇒ "nunca revogou" ⇒ ENVIA. É seguro porque a
--      revogação SEMPRE passa pela RPC, que grava as duas coisas atomicamente. Espelha o AP-277 na
--      direção inversa: ausência de dado nunca SUPRIME lembrete clínico por omissão.
--   2. `authenticated` limpando o próprio flag via PostgREST (UPDATE em user_settings) para voltar a
--      receber push depois de revogar — FECHADO pelo trigger abaixo.
--   3. Backfill de revogados já existentes em prod — feito neste arquivo (hoje: contagem esperada 0,
--      mas o backfill é escrito para ser correto com N > 0).
--   4. Drift trilha↔coluna por escrita fora da RPC — só service_role/DEFINER escreveria, e ações do
--      CONTROLADOR (notice_sent/pruned/account_deleted) não são atos de vontade do titular: não
--      mexem no flag, deliberadamente.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Coluna
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS consent_revoked_at timestamptz;

COMMENT ON COLUMN public.user_settings.consent_revoked_at IS
  'Spec 046: instante da retirada do consentimento de health_data. NULL = consentimento vigente ou '
  'nunca manifestado. Índice OPERACIONAL derivado de consent_log (a prova), escrito na mesma txn por '
  'public.consent_write. NUNCA escrever direto — o trigger trg_user_settings_consent_flag bloqueia.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger: a coluna é do CONTROLADOR, não do titular
-- ─────────────────────────────────────────────────────────────────────────────
-- Sem isto, o auditado desliga a própria suspensão: `authenticated` tem UPDATE em user_settings
-- (RLS escopa à linha dele, mas a linha dele é justamente a que interessa). Ele revogaria o
-- consentimento, zeraria o flag e seguiria recebendo push de dado de saúde — a suspensão viraria
-- decorativa.
--
-- A guarda é `current_user`, e ela SÓ funciona porque a função de trigger é **SECURITY INVOKER**
-- (o default — a ausência de `SECURITY DEFINER` aqui é deliberada, não esquecimento).
--
-- ⚠️ AP-292 SE APLICA E QUASE ME PEGOU: a 1ª versão desta função nasceu `SECURITY DEFINER` e a
-- guarda ficou INERTE — dentro de uma DEFINER, `current_user` é sempre o OWNER, nunca o chamador,
-- então o titular limpava o próprio flag e o trigger não via nada. Como INVOKER, `current_user` é a
-- role do cliente ('authenticated'/'anon') num UPDATE via PostgREST, e é o OWNER quando a chamada
-- vem de dentro de `public.consent_write` (que é DEFINER). É exatamente a distinção que queremos:
-- bloquear o cliente, liberar a RPC. Provado com BEGIN..ROLLBACK contra o banco real, com JWT do
-- próprio dono da linha (senão o teste mede a RLS, não o trigger).
CREATE OR REPLACE FUNCTION public.guard_consent_revoked_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.consent_revoked_at IS DISTINCT FROM OLD.consent_revoked_at
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'consent_revoked_at_is_controller_owned';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_consent_revoked_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_consent_revoked_at() FROM anon;

DROP TRIGGER IF EXISTS trg_user_settings_consent_flag ON public.user_settings;
CREATE TRIGGER trg_user_settings_consent_flag
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_consent_revoked_at();

-- INSERT também precisa ser barrado: um upsert de primeira linha traria o flag já preenchido
-- (ou já limpo) sem passar por UPDATE nenhum.
-- INVOKER, pelo mesmo motivo da função acima (AP-292).
CREATE OR REPLACE FUNCTION public.guard_consent_revoked_at_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.consent_revoked_at IS NOT NULL AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'consent_revoked_at_is_controller_owned';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_consent_revoked_at_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_consent_revoked_at_insert() FROM anon;

DROP TRIGGER IF EXISTS trg_user_settings_consent_flag_ins ON public.user_settings;
CREATE TRIGGER trg_user_settings_consent_flag_ins
  BEFORE INSERT ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_consent_revoked_at_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. consent_write passa a manter o flag na MESMA transação do evento
-- ─────────────────────────────────────────────────────────────────────────────
-- Base: pg_get_functiondef de prod (2026-07-14). Único delta = o bloco de sincronia do flag no fim.
-- O early-return do anti-flood não precisa tocar no flag: se o último evento já é da mesma ação, o
-- flag já reflete essa ação.
CREATE OR REPLACE FUNCTION public.consent_write(p_action text, p_consent_type text, p_platform text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text; v_policy_version text; v_last_id uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_action NOT IN ('granted','revoked') THEN RAISE EXCEPTION 'consent_action_not_allowed'; END IF;
  IF p_consent_type NOT IN ('health_data','terms_privacy') THEN RAISE EXCEPTION 'consent_type_invalid'; END IF;
  IF p_platform NOT IN ('web','mobile','server') THEN RAISE EXCEPTION 'consent_platform_invalid'; END IF;

  SELECT c.id INTO v_last_id FROM public.consent_log c
   WHERE c.user_id = v_uid AND c.consent_type = p_consent_type
   ORDER BY c.created_at DESC LIMIT 1;

  IF v_last_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.consent_log c
     WHERE c.id = v_last_id AND c.action = p_action
       AND c.created_at > now() - interval '10 seconds'
  ) THEN
    RETURN v_last_id;
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN RAISE EXCEPTION 'consent_subject_email_missing'; END IF;

  SELECT p.version INTO v_policy_version FROM public.consent_policy p WHERE p.id = 1;
  IF v_policy_version IS NULL THEN RAISE EXCEPTION 'consent_policy_version_missing'; END IF;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (v_uid, public.consent_subject_hash(v_email), p_consent_type, p_action, v_policy_version, p_platform)
  RETURNING id INTO v_id;

  -- Spec 046 T014: índice operacional do estado revogado, na MESMA txn da prova. Só `health_data`:
  -- é o consentimento que autoriza o tratamento que gera as notificações. `terms_privacy` não
  -- suspende lembrete de dose.
  IF p_consent_type = 'health_data' THEN
    INSERT INTO public.user_settings (user_id, consent_revoked_at)
    VALUES (v_uid, CASE WHEN p_action = 'revoked' THEN now() ELSE NULL END)
    ON CONFLICT (user_id) DO UPDATE
      SET consent_revoked_at = CASE WHEN p_action = 'revoked' THEN now() ELSE NULL END;
  END IF;

  RETURN v_id;
END; $function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill dos revogados já existentes
-- ─────────────────────────────────────────────────────────────────────────────
-- Último ato do TITULAR por titular (granted|revoked) em health_data. Atos do CONTROLADOR
-- (notice_sent/pruned/account_deleted) ficam de fora: um aviso administrativo não revoga ninguém.
-- Linha órfã (user_id NULL, conta já excluída) não tem user_settings para atualizar.
WITH ultimo_ato AS (
  SELECT DISTINCT ON (c.user_id)
         c.user_id, c.action, c.created_at
    FROM public.consent_log c
   WHERE c.consent_type = 'health_data'
     AND c.action IN ('granted','revoked')
     AND c.user_id IS NOT NULL
   ORDER BY c.user_id, c.created_at DESC
)
UPDATE public.user_settings s
   SET consent_revoked_at = CASE WHEN a.action = 'revoked' THEN a.created_at ELSE NULL END
  FROM ultimo_ato a
 WHERE s.user_id = a.user_id;

-- Índice parcial: a varredura de candidatos ao prune (Slice C) pergunta "quem está revogado há
-- >90d". Parcial porque a esmagadora maioria das linhas é NULL — indexá-las seria desperdício.
CREATE INDEX IF NOT EXISTS idx_user_settings_consent_revoked_at
  ON public.user_settings (consent_revoked_at)
  WHERE consent_revoked_at IS NOT NULL;

COMMIT;
