-- =============================================================================
-- 20260621_injection_site.sql — Sítio de injeção em medicine_logs (spec 031, ADR-072)
-- =============================================================================
-- Aditiva e reversível. Adiciona `medicine_logs.injection_site` (enum corporal PT,
-- nullable, domínio FINITO via CHECK — sincronizado com INJECTION_SITE_VALUES do core,
-- R-082/R-271) e propaga o novo parâmetro `p_injection_site` para as RPCs atômicas de
-- registro/atualização (CON-026/ADR-071). Sem backfill: legado = NULL válido.
--
-- Rotação GLOBAL (cross-medicamento) é semântica de QUERY (sem filtro de medicine_id),
-- não shape de storage — ver doseLogService.getLastInjectionSite.
--
-- Reversão: DROP COLUMN injection_site (sem dado órfão); recriar RPCs na versão de 8/9 args.

-- -----------------------------------------------------------------------------
-- 1. Coluna + CHECK (domínio finito; caixa exata)
-- -----------------------------------------------------------------------------
ALTER TABLE public.medicine_logs
  ADD COLUMN IF NOT EXISTS injection_site TEXT;

ALTER TABLE public.medicine_logs
  DROP CONSTRAINT IF EXISTS medicine_logs_injection_site_check;
ALTER TABLE public.medicine_logs
  ADD CONSTRAINT medicine_logs_injection_site_check
  CHECK (
    injection_site IS NULL OR injection_site IN (
      'abdomen_e', 'abdomen_d', 'braco_e', 'braco_d',
      'coxa_e', 'coxa_d', 'gluteo_e', 'gluteo_d'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Índice parcial p/ "último sítio global" (ORDER BY taken_at DESC sobre logs c/ sítio)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_medicine_logs_last_injection_site
  ON public.medicine_logs (user_id, taken_at DESC)
  WHERE injection_site IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. register_dose_atomic — novo param p_injection_site (DEFAULT NULL)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.register_dose_atomic(UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.register_dose_atomic(
  p_user_id UUID,
  p_protocol_id UUID,
  p_medicine_id UUID,
  p_taken_at TIMESTAMPTZ,
  p_quantity_taken NUMERIC,
  p_notes TEXT,
  p_dose_instance_id UUID,
  p_strict_anchor BOOLEAN DEFAULT false,
  p_injection_site TEXT DEFAULT NULL
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
    user_id, protocol_id, medicine_id, taken_at, quantity_taken, notes, dose_instance_id,
    injection_site
  )
  VALUES (
    p_user_id, p_protocol_id, p_medicine_id, p_taken_at, p_quantity_taken, p_notes, NULL,
    p_injection_site
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
    'dose_instance_id', v_linked_instance,
    'injection_site', p_injection_site
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. update_dose_log_atomic — novo param p_injection_site + flag de presença (FR-011)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_dose_log_atomic(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, BOOLEAN, BOOLEAN);
CREATE OR REPLACE FUNCTION public.update_dose_log_atomic(
  p_user_id UUID,
  p_log_id UUID,
  p_protocol_id UUID,
  p_medicine_id UUID,
  p_taken_at TIMESTAMPTZ,
  p_quantity_taken NUMERIC,
  p_notes TEXT,
  p_has_protocol BOOLEAN DEFAULT false,
  p_has_notes BOOLEAN DEFAULT false,
  p_injection_site TEXT DEFAULT NULL,
  p_has_injection_site BOOLEAN DEFAULT false
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
  v_next_injection_site TEXT;
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
  v_next_taken    := COALESCE(p_taken_at, v_old.taken_at);
  -- Nullable: flag de presença permite limpar para NULL.
  v_next_protocol := CASE WHEN p_has_protocol THEN p_protocol_id ELSE v_old.protocol_id END;
  v_next_notes    := CASE WHEN p_has_notes THEN p_notes ELSE v_old.notes END;
  v_next_injection_site := CASE WHEN p_has_injection_site THEN p_injection_site ELSE v_old.injection_site END;

  v_stock_affecting := (v_next_quantity <> v_old.quantity_taken)
                    OR (v_next_medicine <> v_old.medicine_id);

  -- 4. Estorna estoque antigo ANTES de mudar o log (restore lê o log atual)
  IF v_stock_affecting THEN
    PERFORM public.restore_stock_for_log(p_log_id, 'dose_update_restore');
  END IF;

  -- 5. Atualiza o log (taken_at preservado quando edita só o sítio — FR-011)
  UPDATE public.medicine_logs
  SET protocol_id = v_next_protocol,
      medicine_id = v_next_medicine,
      taken_at = v_next_taken,
      quantity_taken = v_next_quantity,
      notes = v_next_notes,
      injection_site = v_next_injection_site
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
    'dose_instance_id', v_new.dose_instance_id,
    'injection_site', v_new.injection_site
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Grants (CLAUDE.md): revoga PUBLIC/anon, concede authenticated + service_role
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.register_dose_atomic(UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_dose_atomic(UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_dose_atomic(UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, UUID, BOOLEAN, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_dose_log_atomic(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_dose_log_atomic(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_dose_log_atomic(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) TO authenticated, service_role;
