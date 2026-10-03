-- 20261002_archive_on_delete.sql — spec 094 · ADR-106 · CON-038 · R-299
-- Excluir tratamento/medicamento ARQUIVA; só a exclusão de conta apaga de fato.
--
-- PROBLEMA (verificado em prod via MCP 2026-09-29 e 2026-10-02):
--   DELETE em protocols leva em CASCADE dose_instances, dose_adherence_monthly e notification_log;
--   DELETE em medicines leva protocols, dose_instances, medicine_logs, stock... O passado (calendário,
--   adesão, relatório) muda retroativamente, sem log nem erro. 456 de 3.272 tomadas já estavam órfãs.
--
-- FIX: trigger BEFORE DELETE (SECURITY INVOKER) em protocols e medicines converte o DELETE em
--   arquivamento (`archived_at`, `active=false`) e devolve NULL — o DELETE vira no-op sem erro,
--   então build antigo que faz `.delete()` também passa a arquivar (FR-011). Saída única: a flag
--   transacional `dosiq.hard_delete` E papel que não seja authenticated/anon — só
--   `_delete_user_account_core` (SECURITY DEFINER, owner postgres) satisfaz as duas (RC-SEC S1).
--   O trigger da 090 (apagar escada só-deste-protocolo) é fundido no ramo hard: no arquivamento a
--   escada CONGELA como histórico.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                   | Análise / mitigação                                     |
-- |----------------------------------------|---------------------------------------------------------|
-- | DELETE de outra pessoa (IDOR)          | RLS de DELETE filtra ANTES do trigger; trigger INVOKER  |
-- |                                        | faz o UPDATE sob a RLS do chamador (S2).                |
-- | Pessoa liga a flag (set_config)        | current_user = authenticated ⇒ arquiva mesmo assim (S1).|
-- | Flag ausente                           | current_setting(...,true) = NULL ⇒ coalesce '' ⇒ arquiva.|
-- | DELETE de linha já arquivada           | não re-carimba archived_at; wipe idempotente; no-op.    |
-- | Doses futuras                          | pending + skipped_paused com scheduled_for > now() saem |
-- |                                        | (= wipeFuturePendingForProtocols); passado de qualquer  |
-- |                                        | status fica. Pending vencida fica (vira missed).        |
-- | Reativar arquivado                     | CHECK (archived_at IS NULL OR active=false) + trigger   |
-- |                                        | BEFORE UPDATE barra limpar archived_at (DQ942).         |
-- | Medicamento em uso                     | protocolo não arquivado OU etapa não-completed de escada|
-- |                                        | viva ⇒ DQ941 (G5a). Escada viva = alguma etapa ligada a |
-- |                                        | protocolo não arquivado.                                |
-- | Cascata medicines→protocols            | só acontece no ramo hard (o mole devolve NULL e não     |
-- |                                        | apaga); no hard a flag vale p/ a cascata (RI roda como  |
-- |                                        | owner, não authenticated).                              |
-- | treatment_plans→protocols SET NULL     | é UPDATE, não DELETE; guarda de UPDATE só olha active/  |
-- |                                        | archived_at ⇒ passa.                                    |
-- | Flag "vaza" após _core                 | set_config local à transação; após o RETURN current_user|
-- |                                        | volta ao chamador ⇒ guarda de papel continua valendo.   |
-- | search_path hijack                     | SET search_path = '' + nomes qualificados.              |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Aditiva: archived_at NULL em todas as linhas existentes; nenhum tratamento vivo muda de estado.
-- Aplicar via Supabase MCP (apply_migration) após o .test.sql verde, junto do deploy web.

-- ─── 1. Colunas + invariante (INV-6) ───────────────────────────────────────────
ALTER TABLE public.protocols ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.protocols DROP CONSTRAINT IF EXISTS protocols_archived_inactive_check;
ALTER TABLE public.protocols ADD CONSTRAINT protocols_archived_inactive_check
  CHECK (archived_at IS NULL OR active = false);

-- ─── 2. DELETE em protocols ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protocols_archive_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF coalesce(current_setting('dosiq.hard_delete', true), '') = 'on'
     AND current_user NOT IN ('authenticated', 'anon') THEN
    -- Ramo hard (exclusão de conta): limpeza de escada da 090, fundida aqui.
    DELETE FROM public.titrations t
     WHERE t.user_id = OLD.user_id
       AND EXISTS (
         SELECT 1 FROM public.titration_steps s
          WHERE s.titration_id = t.id AND s.protocol_id = OLD.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.titration_steps s
          WHERE s.titration_id = t.id AND s.protocol_id IS NOT NULL AND s.protocol_id <> OLD.id
       );
    RETURN OLD;
  END IF;

  -- Ramo mole (qualquer cliente): arquiva. Escada congela como histórico.
  IF OLD.archived_at IS NULL THEN
    UPDATE public.protocols SET active = false, archived_at = now() WHERE id = OLD.id;
  END IF;

  DELETE FROM public.dose_instances d
   WHERE d.protocol_id = OLD.id
     AND d.status IN ('pending', 'skipped_paused')
     AND d.scheduled_for > now();

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.protocols_archive_on_delete() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_protocols_delete_titrations ON public.protocols;
DROP FUNCTION IF EXISTS public.delete_titrations_of_protocol();
DROP TRIGGER IF EXISTS trg_protocols_archive_on_delete ON public.protocols;
CREATE TRIGGER trg_protocols_archive_on_delete
  BEFORE DELETE ON public.protocols
  FOR EACH ROW EXECUTE FUNCTION public.protocols_archive_on_delete();

-- ─── 3. DELETE em medicines ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.medicines_archive_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF coalesce(current_setting('dosiq.hard_delete', true), '') = 'on'
     AND current_user NOT IN ('authenticated', 'anon') THEN
    RETURN OLD;
  END IF;

  IF OLD.archived_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Em uso: tratamento não arquivado, ou etapa ainda por vir/corrente de escada viva (C1.5 G5a).
  IF EXISTS (
       SELECT 1 FROM public.protocols p
        WHERE p.medicine_id = OLD.id AND p.archived_at IS NULL
     )
     OR EXISTS (
       SELECT 1 FROM public.titration_steps s
        WHERE s.medicine_id = OLD.id
          AND s.status IS DISTINCT FROM 'completed'
          AND EXISTS (
            SELECT 1 FROM public.titration_steps s2
              JOIN public.protocols p2 ON p2.id = s2.protocol_id
             WHERE s2.titration_id = s.titration_id AND p2.archived_at IS NULL
          )
     ) THEN
    RAISE EXCEPTION 'medicine_in_use'
      USING ERRCODE = 'DQ941',
            HINT = 'Exclua ou encerre os tratamentos deste medicamento antes de excluí-lo.';
  END IF;

  UPDATE public.medicines SET archived_at = now() WHERE id = OLD.id;
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.medicines_archive_on_delete() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_medicines_archive_on_delete ON public.medicines;
CREATE TRIGGER trg_medicines_archive_on_delete
  BEFORE DELETE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.medicines_archive_on_delete();

-- ─── 4. Arquivado é terminal (FR-006/FR-012) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.archived_is_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'archived_is_terminal' USING ERRCODE = 'DQ942';
  END IF;
  -- IF aninhado: PL/pgSQL avalia a expressão inteira, e NEW.active não existe em medicines (42703).
  IF TG_TABLE_NAME = 'protocols' AND OLD.archived_at IS NOT NULL THEN
    IF NEW.active IS TRUE THEN
      RAISE EXCEPTION 'archived_is_terminal' USING ERRCODE = 'DQ942';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.archived_is_terminal() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_protocols_archived_is_terminal ON public.protocols;
CREATE TRIGGER trg_protocols_archived_is_terminal
  BEFORE UPDATE ON public.protocols
  FOR EACH ROW EXECUTE FUNCTION public.archived_is_terminal();

DROP TRIGGER IF EXISTS trg_medicines_archived_is_terminal ON public.medicines;
CREATE TRIGGER trg_medicines_archived_is_terminal
  BEFORE UPDATE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.archived_is_terminal();

-- ─── 5. Saída única: exclusão de conta (FR-007, PO-7) ─────────────────────────
CREATE OR REPLACE FUNCTION public._delete_user_account_core(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text; v_policy_version text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  -- 094: libera o DELETE efetivo em protocols/medicines (trigger de arquivamento). Local à
  -- transação; a guarda de papel no trigger impede que a pessoa reaproveite a flag.
  PERFORM set_config('dosiq.hard_delete', 'on', true);

  SELECT c.policy_version INTO v_policy_version FROM public.consent_log c
   WHERE c.user_id = p_user_id AND c.action IN ('granted','revoked')
   ORDER BY c.created_at DESC LIMIT 1;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (p_user_id, public.consent_subject_hash(v_email), 'health_data', 'account_deleted', v_policy_version, 'server');

  DELETE FROM public.stock_consumptions        WHERE user_id = p_user_id;
  DELETE FROM public.stock_adjustments         WHERE user_id = p_user_id;
  DELETE FROM public.medicine_logs             WHERE user_id = p_user_id;
  DELETE FROM public.stock                     WHERE user_id = p_user_id;
  DELETE FROM public.purchases                 WHERE user_id = p_user_id;
  DELETE FROM public.failed_notification_queue WHERE user_id = p_user_id;
  DELETE FROM public.notification_log          WHERE user_id = p_user_id;
  DELETE FROM public.notification_devices      WHERE user_id = p_user_id;
  DELETE FROM public.push_notification_logs    WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions        WHERE user_id = p_user_id;
  DELETE FROM public.bot_sessions              WHERE user_id = p_user_id;
  -- 090: etapas referenciam medicines (NO ACTION) — escada sai antes (etapas em CASCADE).
  DELETE FROM public.titrations                WHERE user_id = p_user_id;
  DELETE FROM public.protocols                 WHERE user_id = p_user_id;
  DELETE FROM public.treatment_plans           WHERE user_id = p_user_id;
  DELETE FROM public.medicines                 WHERE user_id = p_user_id;
  DELETE FROM public.gemini_reviews            WHERE user_id = p_user_id;
  DELETE FROM public.user_settings             WHERE user_id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;
END; $function$;
