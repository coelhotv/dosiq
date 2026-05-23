-- 20260522_allow_negative_manual_adjustments.sql
--
-- S2.0 (Fase 3 §0.8) — desbloqueia ajuste manual NEGATIVO em
-- apply_manual_stock_adjustment, habilitando o fluxo "Acertar saldo" (PO-6)
-- para correções de perda/doação/descarte/vencimento manual.
--
-- Antes: delta < 0 lançava exceção (decisão conservadora 2026-04-02).
-- Agora:
--   • delta > 0  → comportamento original (insere lote entry_type='adjustment')
--   • delta < 0  → consome FIFO dos lotes existentes (entry_type != 'legacy_
--                  unrecoverable', quantity > 0), SEM criar stock_consumptions
--                  (não é dose), e registra UM stock_adjustments negativo
--                  (stock_id = NULL — consumo distribuído entre lotes).
--   • saldo nunca fica negativo: valida total disponível >= abs(delta).
--
-- SECURITY DEFINER + search_path fixo (consistente com a função atual).
-- Aplicação manual pelo PO (agente não aplica migration).

CREATE OR REPLACE FUNCTION public.apply_manual_stock_adjustment(
  p_medicine_id uuid,
  p_quantity_delta numeric,
  p_reason text,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_stock public.stock%ROWTYPE;
  v_adjustment public.stock_adjustments%ROWTYPE;
  v_total_available NUMERIC := 0;
  v_remaining NUMERIC;
  v_to_consume NUMERIC;
  v_stock_row public.stock%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity_delta IS NULL OR p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'Quantidade do ajuste deve ser diferente de zero';
  END IF;

  IF NULLIF(TRIM(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motivo do ajuste é obrigatório';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.medicines
    WHERE id = p_medicine_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Medicamento não encontrado para o usuário autenticado';
  END IF;

  -- ── Delta POSITIVO: insere lote de ajuste (comportamento original) ──────────
  IF p_quantity_delta > 0 THEN
    INSERT INTO public.stock (
      medicine_id, quantity, purchase_date, expiration_date, unit_price,
      notes, user_id, purchase_id, original_quantity, entry_type
    )
    VALUES (
      p_medicine_id, p_quantity_delta, CURRENT_DATE, NULL, 0,
      NULLIF(TRIM(p_notes), ''), v_user_id, NULL, p_quantity_delta, 'adjustment'
    )
    RETURNING * INTO v_stock;

    INSERT INTO public.stock_adjustments (
      user_id, medicine_id, stock_id, quantity_delta, reason, reference_id, notes
    )
    VALUES (
      v_user_id, p_medicine_id, v_stock.id, p_quantity_delta,
      NULLIF(TRIM(p_reason), ''), NULL, NULLIF(TRIM(p_notes), '')
    )
    RETURNING * INTO v_adjustment;

    RETURN jsonb_build_object(
      'stock', to_jsonb(v_stock),
      'adjustment', to_jsonb(v_adjustment)
    );
  END IF;

  -- ── Delta NEGATIVO: consome FIFO sem criar stock_consumptions ───────────────
  -- Valida saldo suficiente (não permite saldo negativo).
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_available
  FROM public.stock
  WHERE medicine_id = p_medicine_id
    AND user_id = v_user_id
    AND quantity > 0
    AND entry_type != 'legacy_unrecoverable';

  IF v_total_available < ABS(p_quantity_delta) THEN
    RAISE EXCEPTION 'Saldo insuficiente para o ajuste (disponível: %, solicitado: %)',
      v_total_available, ABS(p_quantity_delta);
  END IF;

  v_remaining := ABS(p_quantity_delta);

  FOR v_stock_row IN
    SELECT *
    FROM public.stock
    WHERE medicine_id = p_medicine_id
      AND user_id = v_user_id
      AND quantity > 0
      AND entry_type != 'legacy_unrecoverable'
    ORDER BY purchase_date ASC, created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_to_consume := LEAST(v_stock_row.quantity, v_remaining);

    UPDATE public.stock
    SET quantity = quantity - v_to_consume
    WHERE id = v_stock_row.id;

    v_remaining := v_remaining - v_to_consume;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Falha de consistência: ajuste negativo FIFO incompleto';
  END IF;

  -- Um único registro de auditoria (delta negativo). stock_id NULL pois o
  -- consumo foi distribuído entre múltiplos lotes.
  INSERT INTO public.stock_adjustments (
    user_id, medicine_id, stock_id, quantity_delta, reason, reference_id, notes
  )
  VALUES (
    v_user_id, p_medicine_id, NULL, p_quantity_delta,
    NULLIF(TRIM(p_reason), ''), NULL, NULLIF(TRIM(p_notes), '')
  )
  RETURNING * INTO v_adjustment;

  RETURN jsonb_build_object(
    'stock', NULL,
    'adjustment', to_jsonb(v_adjustment)
  );
END;
$function$;

-- Grants (idempotente — CREATE OR REPLACE preserva, mas reforçamos o template).
REVOKE EXECUTE ON FUNCTION public.apply_manual_stock_adjustment(uuid, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_manual_stock_adjustment(uuid, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_manual_stock_adjustment(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_manual_stock_adjustment(uuid, numeric, text, text) TO service_role;
