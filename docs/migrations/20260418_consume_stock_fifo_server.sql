-- Migration: overload server-side para consume_stock_fifo
-- Contexto: bot Telegram usa SUPABASE_SERVICE_ROLE_KEY → auth.uid() = NULL
--           A versão existente exige auth.uid() (client-side only)
-- Solução: novo overload que aceita p_user_id explícito, GRANT apenas para service_role
--
-- APLICAR em: Supabase SQL Editor → Run

CREATE OR REPLACE FUNCTION public.consume_stock_fifo(
  p_user_id UUID,
  p_medicine_id UUID,
  p_quantity NUMERIC,
  p_medicine_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := p_user_id;
  v_remaining NUMERIC := p_quantity;
  v_total_available NUMERIC := 0;
  v_total_consumed NUMERIC := 0;
  v_rows_consumed INTEGER := 0;
  v_to_consume NUMERIC;
  v_stock_row public.stock%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório para chamadas server-side';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade para consumo deve ser maior que zero';
  END IF;

  IF p_medicine_log_id IS NULL THEN
    RAISE EXCEPTION 'medicine_log_id é obrigatório';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.medicine_logs
    WHERE id = p_medicine_log_id
      AND medicine_id = p_medicine_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Log de medicamento não encontrado para o usuário';
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_available
  FROM public.stock
  WHERE medicine_id = p_medicine_id
    AND user_id = v_user_id
    AND quantity > 0
    AND entry_type = 'purchase';

  IF v_total_available < p_quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  FOR v_stock_row IN
    SELECT *
    FROM public.stock
    WHERE medicine_id = p_medicine_id
      AND user_id = v_user_id
      AND quantity > 0
      AND entry_type = 'purchase'
    ORDER BY purchase_date ASC, created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_to_consume := LEAST(v_stock_row.quantity, v_remaining);

    UPDATE public.stock
    SET quantity = quantity - v_to_consume
    WHERE id = v_stock_row.id;

    INSERT INTO public.stock_consumptions (
      user_id,
      medicine_log_id,
      medicine_id,
      stock_id,
      quantity_consumed
    )
    VALUES (
      v_user_id,
      p_medicine_log_id,
      p_medicine_id,
      v_stock_row.id,
      v_to_consume
    );

    v_remaining := v_remaining - v_to_consume;
    v_total_consumed := v_total_consumed + v_to_consume;
    v_rows_consumed := v_rows_consumed + 1;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Falha de consistência: consumo FIFO incompleto';
  END IF;

  RETURN jsonb_build_object(
    'medicine_log_id', p_medicine_log_id,
    'medicine_id', p_medicine_id,
    'quantity_requested', p_quantity,
    'quantity_consumed', v_total_consumed,
    'consumption_rows_created', v_rows_consumed
  );
END;
$$;

-- Conceder apenas para service_role (chamadas server-side autorizadas)
-- NÃO conceder para 'authenticated' — users não devem passar user_id arbitrário
REVOKE ALL ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) TO service_role;
