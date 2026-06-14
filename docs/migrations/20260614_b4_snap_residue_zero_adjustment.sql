-- 012 Fase B4 — snap-to-zero de residue float no ajuste manual de saldo.
--
-- Contexto: ajustes manuais sucessivos passavam delta float sujo (ex.: 1,5−1,9 =
-- -0,39999999999999) que persistia como residue na stock.quantity. Ajustar pra "0 ml"
-- depois deixava o lote em ~1e-16 ml (exibido feio "1e-16 ml"). O cleanFloat no JS
-- (adjustToBalance) passa a limpar o delta; esta migração limpa o residue no WRITE:
-- após a subtração FIFO, zera quantidades positivas abaixo de 0,0000005 ml (bem
-- abaixo da granularidade real de 0,01 ml — seguro).
--
-- Idempotente (CREATE OR REPLACE, mesma assinatura → substitui, sem overload).
-- ⚠️ MUTAÇÃO PROD (RPC). Aplicar só com autorização explícita do PO.

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

  -- 012 B4: snap-to-zero — limpa residue float (ex.: 1e-16) deixado por deltas
  -- sujos anteriores. Abaixo de 0,0000005 ml não é estoque real (granularidade 0,01).
  UPDATE public.stock
  SET quantity = 0
  WHERE medicine_id = p_medicine_id
    AND user_id = v_user_id
    AND quantity > 0
    AND quantity < 0.0000005;

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

-- Limpeza one-off do residue já persistido (smoke data). Zera qualquer lote com
-- quantidade positiva microscópica (< 0,0000005 ml) — não afeta saldos reais.
UPDATE public.stock
SET quantity = 0
WHERE quantity > 0 AND quantity < 0.0000005;
