-- 20260608_fix_consume_fifo_ui_conversion.sql
-- 022 Fase C — fix: consume_stock_fifo não convertia dose em 'UI' para ml.
--
-- BUG: a versão da Fase A (20260607_liquid_meds_db.sql) só convertia intake_unit
-- 'gotas' (p_quantity / units_per_ml); 'UI' caía no ELSE e era tratada como ml
-- cru. Ex.: insulina U-100, dose 100 UI → debitava 100 ml do estoque → sempre
-- "Estoque insuficiente". A Fase C expõe dose em UI (refil de caneta de insulina),
-- tornando a conversão obrigatória agora.
--
-- FIX: converter gotas E UI (unidades sub-ml → ÷ densidade); só 'ml' é direto.
-- Espelha doseToMl no @dosiq/core. CREATE OR REPLACE preserva grants/owner.
-- SECURITY DEFINER + SET search_path='' mantidos (search path injection guard).

CREATE OR REPLACE FUNCTION public.consume_stock_fifo(
  p_user_id uuid, p_medicine_id uuid, p_quantity numeric, p_medicine_log_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID := p_user_id; v_is_liquid BOOLEAN; v_units_per_ml NUMERIC; v_intake_unit TEXT;
  v_remaining NUMERIC; v_total_available NUMERIC := 0; v_total_consumed NUMERIC := 0;
  v_rows_consumed INTEGER := 0; v_to_consume NUMERIC; v_stock_row public.stock%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'user_id é obrigatório para chamadas server-side'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade para consumo deve ser maior que zero'; END IF;
  IF p_medicine_log_id IS NULL THEN RAISE EXCEPTION 'medicine_log_id é obrigatório'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.medicine_logs WHERE id=p_medicine_log_id AND medicine_id=p_medicine_id AND user_id=v_user_id) THEN
    RAISE EXCEPTION 'Log de medicamento não encontrado para o usuário'; END IF;
  SELECT (dosage_unit LIKE '%/ml'), COALESCE(NULLIF(units_per_ml,0),20) INTO v_is_liquid, v_units_per_ml
    FROM public.medicines WHERE id=p_medicine_id;
  IF COALESCE(v_is_liquid,FALSE) THEN
    SELECT p.intake_unit INTO v_intake_unit FROM public.protocols p
      JOIN public.medicine_logs l ON l.protocol_id=p.id WHERE l.id=p_medicine_log_id;
    v_intake_unit := COALESCE(v_intake_unit,'ml');
    -- gotas E UI são unidades sub-ml: convertem via densidade (units_per_ml). 'ml' é direto.
    IF lower(v_intake_unit) IN ('gotas','ui') THEN v_remaining := ROUND(p_quantity/v_units_per_ml,2);
    ELSE v_remaining := ROUND(p_quantity,2); END IF;
    IF v_remaining<=0 THEN RAISE EXCEPTION 'Dose muito pequena para débito de estoque (arredondou para 0 ml)'; END IF;
  ELSE v_remaining := p_quantity; END IF;
  SELECT COALESCE(SUM(quantity),0) INTO v_total_available FROM public.stock
    WHERE medicine_id=p_medicine_id AND user_id=v_user_id AND quantity>0 AND (entry_type IS NULL OR entry_type!='legacy_unrecoverable');
  IF v_total_available < v_remaining THEN RAISE EXCEPTION 'Estoque insuficiente'; END IF;
  FOR v_stock_row IN SELECT * FROM public.stock
    WHERE medicine_id=p_medicine_id AND user_id=v_user_id AND quantity>0 AND (entry_type IS NULL OR entry_type!='legacy_unrecoverable')
    ORDER BY purchase_date ASC, created_at ASC, id ASC FOR UPDATE LOOP
    EXIT WHEN v_remaining<=0;
    v_to_consume := LEAST(v_stock_row.quantity, v_remaining);
    UPDATE public.stock SET quantity=quantity-v_to_consume WHERE id=v_stock_row.id;
    INSERT INTO public.stock_consumptions (user_id,medicine_log_id,medicine_id,stock_id,quantity_consumed)
      VALUES (v_user_id,p_medicine_log_id,p_medicine_id,v_stock_row.id,v_to_consume);
    v_remaining := v_remaining-v_to_consume; v_total_consumed := v_total_consumed+v_to_consume;
    v_rows_consumed := v_rows_consumed+1;
  END LOOP;
  IF v_remaining>0 THEN RAISE EXCEPTION 'Falha de consistência: consumo FIFO incompleto'; END IF;
  RETURN jsonb_build_object('medicine_log_id',p_medicine_log_id,'medicine_id',p_medicine_id,
    'is_liquid',v_is_liquid,'quantity_requested',p_quantity,'quantity_consumed',v_total_consumed,
    'consumption_rows_created',v_rows_consumed);
END; $function$;
