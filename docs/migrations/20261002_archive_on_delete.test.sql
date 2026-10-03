-- 20261002_archive_on_delete.test.sql — spec 094 (PO-1, PO-3 banco, PO-6, PO-7, PO-SEC-1, PO-SEC-2)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270/R-288: sem mock do primitivo). Auto-contido: aplica a
-- migração DENTRO da transação (DDL é transacional), exercita o DELETE cru do cliente como
-- `authenticated`, prova e desfaz. PARTE 0 é cópia literal de 20261002_archive_on_delete.sql.
--
-- ┌─ Casos ───────────────────────────────────────────────────────────────────────────────┐
-- |  1 | DELETE cru em protocolo próprio → linha fica, arquivada e inativa  | PO-6       |
-- |  2 | passado (taken/missed/skipped_paused/pending vencida) intacto      | PO-1       |
-- |  3 | futuras pending/skipped_paused removidas                           | PO-3/FR-004|
-- |  4 | dose_adherence_monthly preservada                                  | PO-1       |
-- |  5 | medicine_logs mantém protocol_id                                   | PO-1       |
-- |  6 | escada congela                                                      | edge case  |
-- |  7 | segundo DELETE não re-carimba                                       | idempotência|
-- |  8 | retomar arquivado → DQ942                                           | FR-012     |
-- |  9 | desarquivar → DQ942                                                 | FR-006     |
-- | 10 | CHECK INV-6 instalado                                               | INV-6      |
-- | 11 | medicamento com tratamento ativo → DQ941                            | P1.5       |
-- | 12 | etapa futura de escada viva → DQ941                                 | G5a        |
-- | 13 | etapa futura de escada morta → arquiva                              | G5a        |
-- | 14 | medicamento só com tratamentos arquivados → arquiva                 | PO-6       |
-- | 15 | medicamentos arquivados, linhas preservadas                         | PO-6       |
-- | 16 | histórico do medicamento intacto                                     | PO-6       |
-- | 17 | pessoa liga a flag → arquiva mesmo assim                             | PO-SEC-1   |
-- | 18 | A exclui tratamento/medicamento de B → B intacto                     | PO-SEC-2   |
-- | 19 | exclusão de conta → 0 linhas de A nas tabelas do domínio             | PO-7       |
-- | 20 | consent_log account_deleted                                          | PO-7 audit |
-- | 21 | varredura 046: toda tabela com user_id = 0                           | PO-7 guard |
-- └───────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 0 — a migração sob teste (idêntica ao arquivo .sql)
-- ═══════════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — fixtures (dois usuários; colunas verificadas em information_schema 2026-10-02)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE public._r (n int, caso text, esperado text, obtido text, ok boolean);
GRANT ALL ON public._r TO authenticated;
CREATE TABLE public._ids (k text PRIMARY KEY, v uuid);
GRANT SELECT ON public._ids TO authenticated;
INSERT INTO public._ids (k, v) SELECT k, gen_random_uuid() FROM unnest(ARRAY[
  'u_a','u_b',
  'med_a','med_b','med_c','med_d','med_e',
  'p_a','p_b','p_c','p_d','p_e','p_f',
  'tit_a','tit_live','tit_dead']) k;

CREATE OR REPLACE FUNCTION public._id(p text) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT v FROM public._ids WHERE k = p $$;
GRANT EXECUTE ON FUNCTION public._id(text) TO authenticated;
CREATE OR REPLACE FUNCTION public._as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
END; $fn$;
GRANT EXECUTE ON FUNCTION public._as_user(uuid) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT v, k || '-094@test.local' FROM public._ids WHERE k IN ('u_a','u_b');

-- med_a: tratamento p_a com histórico (alvo de PO-1/PO-6) e p_f (já arquivado no caso 10)
-- med_b: tratamento p_b ATIVO (bloqueia exclusão do medicamento)
-- med_c: só etapa FUTURA de escada viva (executor p_e ativo) — G5a bloqueia
-- med_d: só etapa futura de escada morta (executor p_d arquivado) — G5a não bloqueia
-- med_e: medicamento de B (alvo do IDOR)
INSERT INTO public.medicines (id, user_id, name, dosage_unit, type, presentation)
SELECT public._id(k), public._id(u), k, 'mg', 'medicamento', 'comprimido'
FROM (VALUES ('med_a','u_a'),('med_b','u_a'),('med_c','u_a'),('med_d','u_a'),('med_e','u_b')) x(k,u);

INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, frequency,
                              time_schedule, start_date, active)
SELECT public._id(k), public._id(u), public._id(m), k, 1, 'diário', '["08:00"]'::jsonb,
       current_date - 30, true
FROM (VALUES ('p_a','u_a','med_a'),('p_f','u_a','med_a'),('p_b','u_a','med_b'),
             ('p_c','u_a','med_b'),('p_d','u_a','med_b'),('p_e','u_a','med_b')) x(k,u,m);
-- tratamento de B (IDOR)
INSERT INTO public._ids VALUES ('p_bb', gen_random_uuid());
INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, frequency,
                              time_schedule, start_date, active)
VALUES (public._id('p_bb'), public._id('u_b'), public._id('med_e'), 'p_bb', 1, 'diário',
        '["08:00"]'::jsonb, current_date - 30, true);

-- Histórico de p_a: passado taken/missed/skipped_paused + futuro pending/skipped_paused
INSERT INTO public.dose_instances (user_id, protocol_id, medicine_id, scheduled_for, expected_dose, status)
SELECT public._id('u_a'), public._id('p_a'), public._id('med_a'), now() + o, 1, s
FROM (VALUES (interval '-3 days','taken'),(interval '-2 days','missed'),
             (interval '-1 day','skipped_paused'),(interval '-1 hour','pending'),
             (interval '1 day','pending'),(interval '2 days','skipped_paused')) x(o,s);
-- Doses de B
INSERT INTO public.dose_instances (user_id, protocol_id, medicine_id, scheduled_for, expected_dose, status)
VALUES (public._id('u_b'), public._id('p_bb'), public._id('med_e'), now() - interval '1 day', 1, 'taken'),
       (public._id('u_b'), public._id('p_bb'), public._id('med_e'), now() + interval '1 day', 1, 'pending');

INSERT INTO public.dose_adherence_monthly (user_id, protocol_id, month, expected, taken, missed)
VALUES (public._id('u_a'), public._id('p_a'), date_trunc('month', current_date)::date, 3, 1, 1);

INSERT INTO public.medicine_logs (user_id, protocol_id, medicine_id, taken_at, quantity_taken)
VALUES (public._id('u_a'), public._id('p_a'), public._id('med_a'), now() - interval '3 days', 1);

-- Escadas: tit_a (executor p_a, current) · tit_live (executor p_e ativo + etapa futura med_c)
--          tit_dead (executor p_d, arquivado no caso 13 + etapa futura med_d)
INSERT INTO public.titrations (id, user_id)
SELECT public._id(k), public._id('u_a') FROM unnest(ARRAY['tit_a','tit_live','tit_dead']) k;
INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit,
                                    duration_days, status, protocol_id, started_at)
VALUES
  (public._id('tit_a'),    public._id('u_a'), 0, public._id('med_a'), 1, 'cp', 28, 'current',  public._id('p_a'), now() - interval '5 days'),
  (public._id('tit_live'), public._id('u_a'), 0, public._id('med_b'), 1, 'cp', 28, 'current',  public._id('p_e'), now() - interval '5 days'),
  (public._id('tit_live'), public._id('u_a'), 1, public._id('med_c'), 2, 'cp', 28, 'upcoming', NULL, NULL),
  (public._id('tit_dead'), public._id('u_a'), 0, public._id('med_b'), 1, 'cp', 28, 'current',  public._id('p_d'), now() - interval '5 days'),
  (public._id('tit_dead'), public._id('u_a'), 1, public._id('med_d'), 2, 'cp', 28, 'upcoming', NULL, NULL);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — A exclui p_a pelo DELETE cru do cliente (PO-1, PO-6, PO-3 parte banco)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user(public._id('u_a'));
SET LOCAL ROLE authenticated;
DELETE FROM public.protocols WHERE id = public._id('p_a') AND user_id = public._id('u_a');
RESET ROLE;

INSERT INTO public._r SELECT 1, 'p_a continua existindo, arquivado e inativo', 'linha + archived_at + active=false',
  coalesce(count(*)::text,'0') || ' / ' || bool_and(archived_at IS NOT NULL)::text || ' / ' || bool_and(active)::text,
  count(*) = 1 AND bool_and(archived_at IS NOT NULL) AND NOT bool_and(active)
FROM public.protocols WHERE id = public._id('p_a');
INSERT INTO public._r SELECT 2, 'passado intacto (taken, missed, skipped_paused, pending vencida)', '4',
  count(*)::text, count(*) = 4
FROM public.dose_instances WHERE protocol_id = public._id('p_a') AND scheduled_for <= now();
INSERT INTO public._r SELECT 3, 'futuras pending/skipped_paused removidas', '0', count(*)::text, count(*) = 0
FROM public.dose_instances WHERE protocol_id = public._id('p_a') AND scheduled_for > now();
INSERT INTO public._r SELECT 4, 'dose_adherence_monthly preservada', '1', count(*)::text, count(*) = 1
FROM public.dose_adherence_monthly WHERE protocol_id = public._id('p_a');
INSERT INTO public._r SELECT 5, 'medicine_logs mantém vínculo com o tratamento', '1', count(*)::text, count(*) = 1
FROM public.medicine_logs WHERE protocol_id = public._id('p_a');
INSERT INTO public._r SELECT 6, 'escada congela (não é apagada)', '1 escada / 1 etapa',
  (SELECT count(*) FROM public.titrations WHERE id = public._id('tit_a'))::text || ' / ' ||
  (SELECT count(*) FROM public.titration_steps WHERE titration_id = public._id('tit_a'))::text,
  (SELECT count(*) FROM public.titrations WHERE id = public._id('tit_a')) = 1
  AND (SELECT count(*) FROM public.titration_steps WHERE titration_id = public._id('tit_a')) = 1;

-- Idempotência: segundo DELETE não re-carimba
CREATE TEMP TABLE _stamp AS SELECT archived_at FROM public.protocols WHERE id = public._id('p_a');
GRANT SELECT ON _stamp TO authenticated;
SELECT public._as_user(public._id('u_a'));
SET LOCAL ROLE authenticated;
DELETE FROM public.protocols WHERE id = public._id('p_a');
RESET ROLE;
INSERT INTO public._r SELECT 7, 'segundo DELETE é no-op (archived_at igual)', 'igual',
  (p.archived_at = s.archived_at)::text, p.archived_at = s.archived_at
FROM public.protocols p, _stamp s WHERE p.id = public._id('p_a');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — arquivado é terminal (FR-006/FR-012, INV-6)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user(public._id('u_a'));
SET LOCAL ROLE authenticated;
DO $$ DECLARE v text := 'sem erro'; BEGIN
  BEGIN UPDATE public.protocols SET active = true WHERE id = public._id('p_a');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE; END;
  INSERT INTO public._r VALUES (8, 'retomar arquivado (active=true)', 'DQ942', v, v = 'DQ942');
  v := 'sem erro';
  BEGIN UPDATE public.protocols SET archived_at = NULL WHERE id = public._id('p_a');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE; END;
  INSERT INTO public._r VALUES (9, 'desarquivar (archived_at=NULL)', 'DQ942', v, v = 'DQ942');
END $$;
RESET ROLE;
INSERT INTO public._r SELECT 10, 'CHECK INV-6 instalado', '1', count(*)::text, count(*) = 1
FROM pg_constraint WHERE conname = 'protocols_archived_inactive_check';

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4 — medicamento (US4 / G5a)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user(public._id('u_a'));
SET LOCAL ROLE authenticated;
DELETE FROM public.protocols WHERE id IN (public._id('p_f'), public._id('p_d'));
DO $$ DECLARE v text; BEGIN
  v := 'sem erro';
  BEGIN DELETE FROM public.medicines WHERE id = public._id('med_b');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE; END;
  INSERT INTO public._r VALUES (11, 'medicamento com tratamento ativo bloqueia', 'DQ941', v, v = 'DQ941');
  v := 'sem erro';
  BEGIN DELETE FROM public.medicines WHERE id = public._id('med_c');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE; END;
  INSERT INTO public._r VALUES (12, 'etapa futura de escada viva bloqueia (G5a)', 'DQ941', v, v = 'DQ941');
  v := 'sem erro';
  BEGIN DELETE FROM public.medicines WHERE id = public._id('med_d');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE; END;
  INSERT INTO public._r VALUES (13, 'etapa futura de escada morta não bloqueia (G5a)', 'sem erro', v, v = 'sem erro');
  v := 'sem erro';
  BEGIN DELETE FROM public.medicines WHERE id = public._id('med_a');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE; END;
  INSERT INTO public._r VALUES (14, 'medicamento só com tratamentos arquivados', 'sem erro', v, v = 'sem erro');
END $$;
RESET ROLE;
INSERT INTO public._r SELECT 15, 'med_a e med_d arquivados, linhas preservadas', '2 arquivados',
  count(*) FILTER (WHERE archived_at IS NOT NULL)::text, count(*) FILTER (WHERE archived_at IS NOT NULL) = 2
FROM public.medicines WHERE id IN (public._id('med_a'), public._id('med_d'));
INSERT INTO public._r SELECT 16, 'histórico de med_a intacto após arquivar medicamento', '4 doses / 1 log',
  (SELECT count(*) FROM public.dose_instances WHERE medicine_id = public._id('med_a'))::text || ' doses / ' ||
  (SELECT count(*) FROM public.medicine_logs WHERE medicine_id = public._id('med_a'))::text || ' log',
  (SELECT count(*) FROM public.dose_instances WHERE medicine_id = public._id('med_a')) = 4
  AND (SELECT count(*) FROM public.medicine_logs WHERE medicine_id = public._id('med_a')) = 1;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 5 — PO-SEC-1: a pessoa liga a flag e tenta apagar de fato
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user(public._id('u_a'));
SET LOCAL ROLE authenticated;
SELECT set_config('dosiq.hard_delete', 'on', true);
DELETE FROM public.protocols WHERE id = public._id('p_c');
RESET ROLE;
SELECT set_config('dosiq.hard_delete', '', true);
INSERT INTO public._r SELECT 17, 'flag ligada pela pessoa → arquiva, não apaga (PO-SEC-1)', 'linha + archived_at',
  count(*)::text || ' / ' || coalesce(bool_and(archived_at IS NOT NULL)::text, 'null'),
  count(*) = 1 AND bool_and(archived_at IS NOT NULL)
FROM public.protocols WHERE id = public._id('p_c');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 6 — PO-SEC-2: A tenta excluir tratamento e medicamento de B
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user(public._id('u_a'));
SET LOCAL ROLE authenticated;
DELETE FROM public.protocols WHERE id = public._id('p_bb');
DELETE FROM public.medicines WHERE id = public._id('med_e');
RESET ROLE;
INSERT INTO public._r SELECT 18, 'B intacto após ataque de A (PO-SEC-2)', 'ativo / não arquivado / 2 doses',
  p.active::text || ' / ' || (p.archived_at IS NULL)::text || '+' || (m.archived_at IS NULL)::text || ' / ' ||
  (SELECT count(*) FROM public.dose_instances WHERE protocol_id = p.id)::text,
  p.active AND p.archived_at IS NULL AND m.archived_at IS NULL
  AND (SELECT count(*) FROM public.dose_instances WHERE protocol_id = p.id) = 2
FROM public.protocols p JOIN public.medicines m ON m.id = p.medicine_id WHERE p.id = public._id('p_bb');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 7 — PO-7: exclusão de conta elimina inclusive o arquivado
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._delete_user_account_core(public._id('u_a'));
INSERT INTO public._r SELECT 19, 'exclusão de conta: 0 linhas de A', '0',
  ((SELECT count(*) FROM public.protocols WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.medicines WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.dose_instances WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.dose_adherence_monthly WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.medicine_logs WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.titrations WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.titration_steps WHERE user_id = public._id('u_a')))::text,
  ((SELECT count(*) FROM public.protocols WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.medicines WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.dose_instances WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.dose_adherence_monthly WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.medicine_logs WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.titrations WHERE user_id = public._id('u_a'))
 + (SELECT count(*) FROM public.titration_steps WHERE user_id = public._id('u_a'))) = 0;
INSERT INTO public._r SELECT 20, 'consent_log account_deleted na mesma transação', '1', count(*)::text, count(*) = 1
-- FK user_id é ON DELETE SET NULL (046): a trilha sobrevive anonimizada, achada pelo hash.
FROM public.consent_log WHERE subject_hash = public.consent_subject_hash('u_a-094@test.local') AND action = 'account_deleted';

-- Varredura dinâmica 046: toda tabela public com user_id → 0 linhas de A
DO $$ DECLARE r record; c bigint; tot bigint := 0; sujas text := ''; BEGIN
  FOR r IN SELECT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'user_id'
              AND table_name NOT IN ('consent_log','_r','_ids')
              AND table_name IN (SELECT table_name FROM information_schema.tables
                                  WHERE table_schema = 'public' AND table_type = 'BASE TABLE') LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', r.table_name) INTO c USING public._id('u_a');
    IF c > 0 THEN sujas := sujas || r.table_name || '=' || c || ' '; END IF;
    tot := tot + c;
  END LOOP;
  INSERT INTO public._r VALUES (21, 'varredura 046: toda tabela com user_id = 0', '0',
    tot::text || CASE WHEN sujas <> '' THEN ' (' || sujas || ')' ELSE '' END, tot = 0);
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESULTADO
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT n, CASE WHEN ok THEN 'PASS' ELSE '*** FAIL ***' END AS r, caso, esperado, obtido
FROM public._r ORDER BY n;

ROLLBACK;
