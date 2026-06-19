-- Migration: orquestração atômica de tomada de dose (Spec 035 — Option A)
-- Contexto: elimina a janela de log órfão / furo de estoque (classe AP-231). O fluxo
--           insert log → consume stock → (mark instance) passa a rodar DENTRO de uma
--           única transação Postgres por RPC. Se o estoque faltar (ou a ocorrência não
--           estiver elegível, no modo strict), TODA a transação é revertida pelo banco
--           — sem rollback compensatório em JS.
--
-- Reutiliza as RPCs existentes consume_stock_fifo / restore_stock_for_log (atômicas
-- internamente) como building blocks, agora compostas numa transação maior.
--
-- Schema verificado em 2026-06-19 (projeto dosiq, prod):
--   medicine_logs  → id, protocol_id, medicine_id, taken_at, quantity_taken, notes,
--                    user_id, dose_instance_id   (SEM created_at / updated_at)
--   dose_instances → ... status, medicine_log_id, scheduled_for, tolerance_minutes
--                    (SEM updated_at)
--
-- Segurança (CLAUDE.md): SECURITY DEFINER + SET search_path = '' + objetos schema-qualificados.
-- Isolamento de tenant: usuário autenticado não pode passar p_user_id de terceiros
-- (service_role/bot passa p_user_id explícito e é isento do gate).
--
-- APLICAR em: Supabase SQL Editor → Run

-- =============================================================================
-- 1. register_dose_atomic
-- =============================================================================
-- INSERT do log + consumo FIFO + (best-effort/strict) ancoragem da ocorrência,
-- tudo numa transação. p_strict_anchor=true (tomada direta numa ocorrência): se a
-- ocorrência não estiver elegível (double-click / corrida) a transação inteira é
-- revertida → nenhum log criado, nenhum estoque consumido (Edge Case #1 da spec).
-- p_strict_anchor=false (snap retroativo / avulsa): ancoragem é best-effort; se a
-- ocorrência não puder ser marcada, o log persiste avulso sem falhar o registro.
CREATE OR REPLACE FUNCTION public.register_dose_atomic(
  p_user_id UUID,
  p_protocol_id UUID,
  p_medicine_id UUID,
  p_taken_at TIMESTAMPTZ,
  p_quantity_taken NUMERIC,
  p_notes TEXT,
  p_dose_instance_id UUID,
  p_strict_anchor BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_log_id UUID;
  v_linked_instance UUID := NULL;
  v_marked BOOLEAN := false;
BEGIN
  -- 1. Isolamento de tenant
  IF auth.role() = 'authenticated' AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  -- 2. Insere o log (dose_instance_id resolvido só após marcação bem-sucedida)
  INSERT INTO public.medicine_logs (
    user_id, protocol_id, medicine_id, taken_at, quantity_taken, notes, dose_instance_id
  )
  VALUES (
    p_user_id, p_protocol_id, p_medicine_id, p_taken_at, p_quantity_taken, p_notes, NULL
  )
  RETURNING id INTO v_log_id;

  -- 3. Consome estoque FIFO (RAISE 'Estoque insuficiente' reverte tudo)
  PERFORM public.consume_stock_fifo(p_user_id, p_medicine_id, p_quantity_taken, v_log_id);

  -- 4. Ancoragem da ocorrência (mesma transição de markTaken: pending/missed/skipped_user)
  IF p_dose_instance_id IS NOT NULL THEN
    UPDATE public.dose_instances
    SET status = 'taken', medicine_log_id = v_log_id
    WHERE id = p_dose_instance_id
      AND user_id = p_user_id
      AND status IN ('pending', 'missed', 'skipped_user');

    GET DIAGNOSTICS v_marked = ROW_COUNT;

    IF v_marked THEN
      UPDATE public.medicine_logs SET dose_instance_id = p_dose_instance_id WHERE id = v_log_id;
      v_linked_instance := p_dose_instance_id;
    ELSIF p_strict_anchor THEN
      -- Ocorrência já tomada/editada concorrentemente → aborta toda a transação
      RAISE EXCEPTION 'Ocorrência já registrada ou indisponível';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_log_id,
    'user_id', p_user_id,
    'protocol_id', p_protocol_id,
    'medicine_id', p_medicine_id,
    'taken_at', to_char(p_taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'quantity_taken', p_quantity_taken,
    'notes', p_notes,
    'dose_instance_id', v_linked_instance
  );
END;
$$;

-- =============================================================================
-- 2. update_dose_log_atomic
-- =============================================================================
-- Atualiza um log. Campos não informados (NULL) preservam o valor antigo (COALESCE).
-- Se quantidade ou medicamento mudarem: estorna o estoque antigo, atualiza e consome
-- o novo — tudo na mesma transação. Falha de estoque reverte a atualização inteira.
CREATE OR REPLACE FUNCTION public.update_dose_log_atomic(
  p_user_id UUID,
  p_log_id UUID,
  p_protocol_id UUID,
  p_medicine_id UUID,
  p_taken_at TIMESTAMPTZ,
  p_quantity_taken NUMERIC,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old RECORD;
  v_next_medicine UUID;
  v_next_quantity NUMERIC;
  v_next_protocol UUID;
  v_next_taken TIMESTAMPTZ;
  v_next_notes TEXT;
  v_stock_affecting BOOLEAN;
  v_new RECORD;
BEGIN
  -- 1. Isolamento de tenant
  IF auth.role() = 'authenticated' AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  -- 2. Lock do log
  SELECT * INTO v_old FROM public.medicine_logs
    WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de tomada de dose não encontrado';
  END IF;

  -- 3. Valores efetivos (partial update via COALESCE)
  v_next_medicine := COALESCE(p_medicine_id, v_old.medicine_id);
  v_next_quantity := COALESCE(p_quantity_taken, v_old.quantity_taken);
  v_next_protocol := COALESCE(p_protocol_id, v_old.protocol_id);
  v_next_taken    := COALESCE(p_taken_at, v_old.taken_at);
  v_next_notes    := COALESCE(p_notes, v_old.notes);

  v_stock_affecting := (v_next_quantity <> v_old.quantity_taken)
                    OR (v_next_medicine <> v_old.medicine_id);

  -- 4. Estorna estoque antigo ANTES de mudar o log (restore lê o log atual)
  IF v_stock_affecting THEN
    PERFORM public.restore_stock_for_log(p_log_id, 'dose_update_restore');
  END IF;

  -- 5. Atualiza o log
  UPDATE public.medicine_logs
  SET protocol_id = v_next_protocol,
      medicine_id = v_next_medicine,
      taken_at = v_next_taken,
      quantity_taken = v_next_quantity,
      notes = v_next_notes
  WHERE id = p_log_id AND user_id = p_user_id
  RETURNING * INTO v_new;

  -- 6. Consome o novo estoque (RAISE reverte estorno + update na mesma transação)
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
    'dose_instance_id', v_new.dose_instance_id
  );
END;
$$;

-- =============================================================================
-- 3. delete_dose_log_atomic
-- =============================================================================
-- Estorna o estoque, reverte a ocorrência ancorada (pending/missed conforme a
-- tolerância DA PRÓPRIA ocorrência, fallback p_default_tolerance_minutes) e remove
-- o log — numa transação. Cobre tanto undo (dose agendada) quanto delete de avulsa.
CREATE OR REPLACE FUNCTION public.delete_dose_log_atomic(
  p_user_id UUID,
  p_log_id UUID,
  p_default_tolerance_minutes INT DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_log RECORD;
  v_scheduled TIMESTAMPTZ;
  v_tolerance INT;
  v_new_status TEXT;
BEGIN
  -- 1. Isolamento de tenant
  IF auth.role() = 'authenticated' AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  -- 2. Lock do log
  SELECT * INTO v_log FROM public.medicine_logs
    WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de tomada de dose não encontrado';
  END IF;

  -- 3. Estorna estoque associado
  PERFORM public.restore_stock_for_log(p_log_id, 'dose_deleted_restore');

  -- 4. Reverte a ocorrência ancorada (best-effort, só se ainda estiver 'taken')
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

  -- 5. Remove o log
  DELETE FROM public.medicine_logs WHERE id = p_log_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'id', v_log.id,
    'dose_instance_id', v_log.dose_instance_id,
    'success', true
  );
END;
$$;

-- =============================================================================
-- Grants (CLAUDE.md): revoga PUBLIC/anon, concede authenticated + service_role
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.register_dose_atomic(UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_dose_atomic(UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_dose_atomic(UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, UUID, BOOLEAN) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_dose_log_atomic(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_dose_log_atomic(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_dose_log_atomic(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_dose_log_atomic(UUID, UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_dose_log_atomic(UUID, UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_dose_log_atomic(UUID, UUID, INT) TO authenticated, service_role;
