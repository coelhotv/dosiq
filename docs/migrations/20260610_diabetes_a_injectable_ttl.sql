-- 20260610_diabetes_a_injectable_ttl.sql
-- 012 Fase A — forma injetável + validade biológica (TTL). ADR-059.
--
-- 1) medicines.shelf_life_days: TTL pós-abertura em dias (propriedade do PRODUTO;
--    distinto de expiration_date, que é a validade da caixa fechada). NULL = eixo
--    de validade biológica inativo. Ex.: insulina ≈ 28.
-- 2) stock.opened_at: instante de abertura do LOTE, inferido na 1ª tomada que o
--    debita (não existe "abrir sem usar"). NULL = lote fechado. Lotes existentes
--    permanecem NULL (nenhum vira "aberto" retroativamente).
-- 3) consume_stock_fifo: única mudança = inferir opened_at no loop FIFO
--    (WHERE opened_at IS NULL → now(); nunca re-seta). Setado em TODO lote
--    consumido, incl. sólidos — inócuo: o eixo TTL só ativa com shelf_life_days.
--    Estorno (restore_stock_for_log) NÃO reverte opened_at: abertura física é
--    irreversível. Assinatura intacta (AP-221: zero impacto em callers).
--
-- Colunas em tabelas existentes não exigem novos GRANTs (regra CLAUDE.md vale
-- para CREATE TABLE). RLS vigente preservada.

ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER DEFAULT NULL;
ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_shelf_life_days_check;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_shelf_life_days_check
  CHECK (shelf_life_days IS NULL OR shelf_life_days > 0);

ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NULL;

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
    -- 012 Fase A (ADR-059): 1ª tomada que debita o lote infere a abertura.
    -- opened_at IS NULL garante set único (nunca re-seta em consumos seguintes).
    UPDATE public.stock SET quantity=quantity-v_to_consume,
      opened_at = COALESCE(opened_at, now())
      WHERE id=v_stock_row.id;
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

-- Verificação pós-migração:
--   SELECT count(*) FROM public.medicines WHERE shelf_life_days IS NOT NULL;  -- esperado: 0
--   SELECT count(*) FROM public.stock WHERE opened_at IS NOT NULL;            -- esperado: 0
