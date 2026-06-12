-- 20260612_diabetes_b2_glp1_mg.sql
-- 012 Fase B2 — canetas/ampolas GLP-1: dose em mg sobre líquido + container.
-- APLICADA EM PROD 2026-06-12 (autorização PO). Verificado: CHECK intake_unit
-- com 'mg', coluna injection_container + CHECK enum (0 linhas), RPC contém 'mg'.
--
-- Modelo: caneta/ampola = lote líquido em ml (reusa fundação 022). GLP-1 tem
-- dosage_unit='mg/ml' → já é líquido (dosage_unit LIKE '%/ml'). A peça nova é a
-- unidade de TOMADA 'mg' (a dose prescrita é "0,25 mg", não "X ml").
--
-- 1) protocols.intake_unit CHECK += 'mg' (R-271 — sincronizado com INTAKE_UNITS
--    do core, caixa exata). Aditivo: linhas existentes (gotas/ml/UI) inalteradas;
--    nenhuma linha tinha 'mg' (sem backfill).
-- 2) medicines.injection_container: enum da apresentação física comprada
--    (caneta/ampola/frasco_ampola/seringa_preenchida). NULL = não informado →
--    rótulo "unidade". Capturado na 1ª compra (FR-019). Só rótulo de UI; não
--    afeta cálculo de estoque. Coluna em tabela existente não exige novos GRANTs.
-- 3) consume_stock_fifo: ÚNICA mudança = 'mg' no ramo sub-ml de conversão por
--    densidade — mg ÷ units_per_ml(mg/ml) = ml. Assinatura INTACTA (AP-221: zero
--    impacto em callers). Corpo copiado do pg_get_functiondef ao vivo (AP-217:
--    preserva guards de posse, entry_type FIFO, opened_at, SECURITY DEFINER,
--    search_path=''). Default densidade 20 mantido: para mg o form de tratamento
--    (FR-018) é a barreira que garante units_per_ml — a RPC nunca trava a tomada.

-- 1) intake_unit += 'mg'
ALTER TABLE public.protocols DROP CONSTRAINT IF EXISTS protocols_intake_unit_check;
ALTER TABLE public.protocols ADD CONSTRAINT protocols_intake_unit_check
  CHECK (intake_unit = ANY (ARRAY['gotas'::text, 'ml'::text, 'UI'::text, 'mg'::text]));

-- 2) medicines.injection_container
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS injection_container TEXT DEFAULT NULL;
ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_injection_container_check;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_injection_container_check
  CHECK (injection_container IS NULL OR injection_container = ANY (
    ARRAY['caneta'::text, 'ampola'::text, 'frasco_ampola'::text, 'seringa_preenchida'::text]));

-- 3) consume_stock_fifo — +'mg' no ramo sub-ml (assinatura intacta)
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
  v_concentration NUMERIC; v_remaining NUMERIC; v_total_available NUMERIC := 0; v_total_consumed NUMERIC := 0;
  v_rows_consumed INTEGER := 0; v_to_consume NUMERIC; v_stock_row public.stock%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'user_id é obrigatório para chamadas server-side'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade para consumo deve ser maior que zero'; END IF;
  IF p_medicine_log_id IS NULL THEN RAISE EXCEPTION 'medicine_log_id é obrigatório'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.medicine_logs WHERE id=p_medicine_log_id AND medicine_id=p_medicine_id AND user_id=v_user_id) THEN
    RAISE EXCEPTION 'Log de medicamento não encontrado para o usuário'; END IF;
  -- dosage_per_pill p/ líquido mg/ml = CONCENTRAÇÃO (mg por ml); units_per_ml = razão
  -- física p/ gotas/UI (gotas-por-ml / UI-por-ml). São campos distintos (012 Fase B2).
  SELECT (dosage_unit LIKE '%/ml'), COALESCE(NULLIF(units_per_ml,0),20), dosage_per_pill
    INTO v_is_liquid, v_units_per_ml, v_concentration
    FROM public.medicines WHERE id=p_medicine_id;
  IF COALESCE(v_is_liquid,FALSE) THEN
    SELECT p.intake_unit INTO v_intake_unit FROM public.protocols p
      JOIN public.medicine_logs l ON l.protocol_id=p.id WHERE l.id=p_medicine_log_id;
    v_intake_unit := COALESCE(v_intake_unit,'ml');
    -- mg: dose em mg sobre líquido mg/ml → mg ÷ CONCENTRAÇÃO (dosage_per_pill) = ml.
    --   A concentração já vem do cadastro do medicamento (não pede densidade extra).
    -- gotas/UI: razão física sub-ml → dividem por units_per_ml. 'ml' é direto.
    IF lower(v_intake_unit) = 'mg' THEN
      IF v_concentration IS NULL OR v_concentration <= 0 THEN
        RAISE EXCEPTION 'Concentração (mg/ml) do medicamento ausente — não dá para converter mg em ml';
      END IF;
      v_remaining := ROUND(p_quantity/v_concentration,2);
    ELSIF lower(v_intake_unit) IN ('gotas','ui') THEN v_remaining := ROUND(p_quantity/v_units_per_ml,2);
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
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname='protocols_intake_unit_check';  -- deve listar 'mg'
--   SELECT count(*) FROM public.medicines WHERE injection_container IS NOT NULL;  -- esperado: 0
--   -- Smoke RPC mg (BEGIN..ROLLBACK em conta de teste): dose 0,25 mg, units_per_ml=0,68
--   --   → v_remaining = ROUND(0.25/0.68,2) = 0.37 ml.
