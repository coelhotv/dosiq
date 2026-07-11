-- ─────────────────────────────────────────────────────────────────────────────
-- 20260711_stock_fn_hardening.sql — Spec 044 F2 (T007b + T007c)
--
-- Dívida SQL DORMENTE encontrada no preflight R-270 da F1 (dump de prod, PR #735).
-- Nenhum dos dois quebra o app hoje; ambos quebram no primeiro caller que sair do
-- caminho feliz (cron/bot/import/script que não passe por sessão autenticada + Zod).
--
-- T007b — restore_stock_for_log:
--   (a) resolve o dono por `auth.uid()` em vez do p_user_id que a RPC chamadora já
--       tem em mãos → chamada server-side (service_role, sem sessão) morre com
--       'Usuário não autenticado'. Fix: parâmetro `p_user_id uuid DEFAULT NULL` +
--       `v_user_id := COALESCE(p_user_id, auth.uid())`, com RAISE quando os DOIS
--       forem NULL (nunca seguir com dono indefinido).
--       ⚠️ Parâmetro novo em CREATE OR REPLACE cria OVERLOAD (AP-227) → DROP da
--       assinatura antiga (uuid, text) ANTES do CREATE. Caller JS atualizado na
--       MESMA fase (AP-221): packages/core/src/repositories/createStockRepository.ts.
--   (b) `SET search_path = 'public'` (as 3 irmãs atômicas usam ''). Alinhado p/ ''
--       com o body inteiro schema-qualificado (previne search path injection).
--   (c) update_dose_log_atomic / delete_dose_log_atomic passam a repassar p_user_id
--       na chamada — sem isso a correção (a) fica pela metade: o caminho server-side
--       de desfazer/editar dose continuaria dependendo de auth.uid(). Bodies idênticos
--       aos da F1 (base = 20260707_stock_tracking_preference.sql, aplicada em prod);
--       ÚNICA mudança = o argumento novo no PERFORM. Assinaturas INALTERADAS.
--       (register_dose_atomic não chama restore_stock_for_log → não é tocada.)
--
-- T007c — medicines.type: DEFAULT 'medicine' em prod VIOLA o próprio CHECK da tabela
--   (medicines_type_check aceita só 'medicamento'|'suplemento') → todo INSERT que
--   omita `type` é recusado pelo banco. Hoje mascarado pelo Zod (medicineSchema tem
--   .default('medicamento')) — proteção por acidente, não por desenho.
--
-- Grants: CREATE OR REPLACE preserva grants; DROP+CREATE **não** → restore_stock_for_log
-- re-recebe REVOKE de PUBLIC/anon + GRANT explícito (AP-278, CLAUDE.md §Migrações).
--
-- Teste: 20260711_stock_fn_hardening.test.sql (BEGIN..ROLLBACK contra o banco real).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. restore_stock_for_log — dono explícito + search_path = ''
-- ─────────────────────────────────────────────────────────────────────────────

-- AP-227: sem o DROP, a assinatura antiga (uuid, text) sobreviveria ao lado da nova
-- (uuid, text, uuid) → PGRST203 (ambiguidade) ou resolução silenciosa p/ a versão velha.
DROP FUNCTION IF EXISTS public.restore_stock_for_log(uuid, text);

CREATE OR REPLACE FUNCTION public.restore_stock_for_log(
  p_medicine_log_id uuid,
  p_reason text DEFAULT 'dose_deleted_restore'::text,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
  v_restored_total NUMERIC := 0;
  v_restored_rows INTEGER := 0;
  v_consumption RECORD;
BEGIN
  -- Dono explícito (server-side/service_role) OU dono da sessão (web/mobile).
  v_user_id := COALESCE(p_user_id, auth.uid());

  -- Nunca seguir com dono indefinido: sem param e sem sessão, aborta.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Defesa em profundidade (AP-278): com p_user_id explícito, o grant deixa de ser a
  -- única camada. Um authenticated não pode restaurar estoque de terceiro.
  IF auth.role() = 'anon'
     OR (auth.role() = 'authenticated' AND auth.uid() <> v_user_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  IF p_medicine_log_id IS NULL THEN
    RAISE EXCEPTION 'medicine_log_id é obrigatório';
  END IF;

  FOR v_consumption IN
    SELECT sc.*, s.medicine_id
    FROM public.stock_consumptions sc
    JOIN public.stock s
      ON s.id = sc.stock_id
    WHERE sc.user_id = v_user_id
      AND sc.medicine_log_id = p_medicine_log_id
      AND sc.reversed_at IS NULL
    ORDER BY sc.created_at ASC, sc.id ASC
    FOR UPDATE OF sc, s
  LOOP
    UPDATE public.stock
    SET quantity = quantity + v_consumption.quantity_consumed
    WHERE id = v_consumption.stock_id;

    UPDATE public.stock_consumptions
    SET reversed_at = now()
    WHERE id = v_consumption.id
      AND reversed_at IS NULL;

    INSERT INTO public.stock_adjustments (
      user_id,
      medicine_id,
      stock_id,
      quantity_delta,
      reason,
      reference_id,
      notes
    )
    VALUES (
      v_user_id,
      v_consumption.medicine_id,
      v_consumption.stock_id,
      v_consumption.quantity_consumed,
      COALESCE(NULLIF(TRIM(p_reason), ''), 'dose_deleted_restore'),
      p_medicine_log_id,
      'Restauração automática de estoque por reversão de log'
    );

    v_restored_total := v_restored_total + v_consumption.quantity_consumed;
    v_restored_rows := v_restored_rows + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'medicine_log_id', p_medicine_log_id,
    'quantity_restored', v_restored_total,
    'restored_rows', v_restored_rows,
    'already_restored', (v_restored_rows = 0)
  );
END;
$function$;

-- DROP+CREATE zera os grants → reafirmar least privilege (AP-278).
REVOKE EXECUTE ON FUNCTION public.restore_stock_for_log(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_stock_for_log(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_stock_for_log(uuid, text, uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. update_dose_log_atomic — repassa p_user_id no restore (assinatura INALTERADA)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_dose_log_atomic(
  p_user_id uuid,
  p_log_id uuid,
  p_protocol_id uuid,
  p_medicine_id uuid,
  p_taken_at timestamp with time zone,
  p_quantity_taken numeric,
  p_notes text,
  p_has_protocol boolean DEFAULT false,
  p_has_notes boolean DEFAULT false,
  p_injection_site text DEFAULT NULL::text,
  p_has_injection_site boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old RECORD;
  v_next_medicine UUID;
  v_next_quantity NUMERIC;
  v_next_protocol UUID;
  v_next_taken TIMESTAMPTZ;
  v_next_notes TEXT;
  v_next_injection_site TEXT;
  v_stock_affecting BOOLEAN;
  v_new RECORD;
  v_stock_tracking BOOLEAN := true;  -- Spec 044: TRUE por omissão.
BEGIN
  -- Defesa em profundidade (review #735): bloquear `anon` EXPLICITAMENTE.
  IF auth.role() = 'anon'
     OR (auth.role() = 'authenticated' AND auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT us.stock_tracking_enabled INTO v_stock_tracking
    FROM public.user_settings us
    WHERE us.user_id = p_user_id;
  -- COALESCE **depois** do SELECT (AP-277): `SELECT INTO` sem linha atribui NULL à
  -- variável (NÃO preserva o valor de inicialização) → fail-OPEN silencioso.
  v_stock_tracking := COALESCE(v_stock_tracking, true);

  SELECT * INTO v_old FROM public.medicine_logs
    WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de tomada de dose não encontrado';
  END IF;

  v_next_medicine := COALESCE(p_medicine_id, v_old.medicine_id);
  v_next_quantity := COALESCE(p_quantity_taken, v_old.quantity_taken);
  v_next_taken    := COALESCE(p_taken_at, v_old.taken_at);
  v_next_protocol := CASE WHEN p_has_protocol THEN p_protocol_id ELSE v_old.protocol_id END;
  v_next_notes    := CASE WHEN p_has_notes THEN p_notes ELSE v_old.notes END;
  v_next_injection_site := CASE WHEN p_has_injection_site THEN p_injection_site ELSE v_old.injection_site END;

  v_stock_affecting := v_stock_tracking
                   AND ((v_next_quantity <> v_old.quantity_taken)
                     OR (v_next_medicine <> v_old.medicine_id));

  IF v_stock_affecting THEN
    -- T007b: dono explícito — o caminho server-side (service_role, sem sessão) deixa
    -- de depender de auth.uid() dentro de restore_stock_for_log.
    PERFORM public.restore_stock_for_log(p_log_id, 'dose_update_restore', p_user_id);
  END IF;

  UPDATE public.medicine_logs
  SET protocol_id = v_next_protocol,
      medicine_id = v_next_medicine,
      taken_at = v_next_taken,
      quantity_taken = v_next_quantity,
      notes = v_next_notes,
      injection_site = v_next_injection_site
  WHERE id = p_log_id AND user_id = p_user_id
  RETURNING * INTO v_new;

  IF v_stock_affecting THEN
    PERFORM public.consume_stock_fifo(p_user_id, v_next_medicine, v_next_quantity, p_log_id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_new.id,
    'user_id', v_new.user_id,
    'protocol_id', v_new.protocol_id,
    'medicine_id', v_new.medicine_id,
    'taken_at', to_char(v_new.taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'quantity_taken', v_new.quantity_taken,
    'notes', v_new.notes,
    'dose_instance_id', v_new.dose_instance_id,
    'injection_site', v_new.injection_site
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. delete_dose_log_atomic — repassa p_user_id no restore (assinatura INALTERADA)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_dose_log_atomic(
  p_user_id uuid,
  p_log_id uuid,
  p_default_tolerance_minutes integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_log RECORD;
  v_scheduled TIMESTAMPTZ;
  v_tolerance INT;
  v_new_status TEXT;
  v_stock_tracking BOOLEAN := true;  -- Spec 044: TRUE por omissão.
BEGIN
  -- Defesa em profundidade (review #735): bloquear `anon` EXPLICITAMENTE.
  IF auth.role() = 'anon'
     OR (auth.role() = 'authenticated' AND auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT us.stock_tracking_enabled INTO v_stock_tracking
    FROM public.user_settings us
    WHERE us.user_id = p_user_id;
  -- COALESCE **depois** do SELECT (AP-277).
  v_stock_tracking := COALESCE(v_stock_tracking, true);

  SELECT * INTO v_log FROM public.medicine_logs
    WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de tomada de dose não encontrado';
  END IF;

  IF v_stock_tracking THEN
    -- T007b: dono explícito (ver update_dose_log_atomic).
    PERFORM public.restore_stock_for_log(p_log_id, 'dose_deleted_restore', p_user_id);
  END IF;

  IF v_log.dose_instance_id IS NOT NULL THEN
    SELECT scheduled_for, COALESCE(tolerance_minutes, p_default_tolerance_minutes)
      INTO v_scheduled, v_tolerance
      FROM public.dose_instances
      WHERE id = v_log.dose_instance_id AND user_id = p_user_id;

    IF FOUND THEN
      IF now() <= v_scheduled + (v_tolerance * INTERVAL '1 minute') THEN
        v_new_status := 'pending';
      ELSE
        v_new_status := 'missed';
      END IF;

      UPDATE public.dose_instances
      SET status = v_new_status, medicine_log_id = NULL
      WHERE id = v_log.dose_instance_id AND user_id = p_user_id AND status = 'taken';
    END IF;
  END IF;

  DELETE FROM public.medicine_logs WHERE id = p_log_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'id', v_log.id,
    'dose_instance_id', v_log.dose_instance_id,
    'success', true
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. T007c — medicines.type: DEFAULT alinhado ao CHECK da própria tabela
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.medicines ALTER COLUMN type SET DEFAULT 'medicamento';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação pós-aplicação (rodar manualmente após o COMMIT):
--
--   -- UMA assinatura por função (zero overload — AP-227):
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid), p.proconfig,
--          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('restore_stock_for_log','update_dose_log_atomic','delete_dose_log_atomic');
--   -- esperado: restore_stock_for_log com UMA linha (uuid, text, uuid),
--   --           search_path="" nas três, anon_exec = false nas três.
--
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='medicines' AND column_name='type';
--   -- esperado: 'medicamento'::text
-- ─────────────────────────────────────────────────────────────────────────────
