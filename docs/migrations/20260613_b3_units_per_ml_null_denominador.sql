-- 012 Fase B3 — units_per_ml default NULL + backfill unit-aware + coluna concentration_volume_ml
-- + RPC consume_stock_fifo unit-aware. ADR-065 + ADR-066.
--
-- APLICADA EM PROD 2026-06-13 (autorização PO). Verificada: default=null; coluna criada;
-- backfill 3 linhas 20→NULL (Durateston/Tresiba/Xarope); Dipirona=20, Lantus=100; RPC UI unit-aware.
-- Idempotente. RPC reescrita do pg_get_functiondef AO VIVO (AP-217): assinatura intacta
-- (AP-221 — nenhum caller muda; AP-209 — sem overload). Única mudança no corpo: densidade
-- gotas/UI deixa de cair no blanket 20 e passa a ser unit-aware (gotas→20, UI→100).
--
-- Baseline prod (2026-06-13): 6 líquidos/111; backfill esperado = 3 linhas 20→NULL
-- (Durateston=sem-trat, Xarope=ml, Tresiba=ml); Dipirona(gotas)=20 e Lantus(UI)=100 mantêm;
-- Mounjaro(mg) já NULL.

-- 1) units_per_ml: remove o DEFAULT 20 (blanket) — novas linhas nascem NULL
ALTER TABLE public.medicines ALTER COLUMN units_per_ml DROP DEFAULT;

-- 2) Backfill derivado da unidade de tomada do tratamento (ADR-065): UI→100, gotas→20,
--    demais (mg/ml/sem-tratamento)→NULL. Só líquidos; tie-break UI>gotas. IS DISTINCT FROM
--    evita updates no-op.
UPDATE public.medicines m
   SET units_per_ml = sub.new_upm
  FROM (
    SELECT med.id,
           CASE
             WHEN bool_or(lower(p.intake_unit) = 'ui')    THEN 100
             WHEN bool_or(lower(p.intake_unit) = 'gotas')  THEN 20
             ELSE NULL
           END AS new_upm
      FROM public.medicines med
      LEFT JOIN public.protocols p ON p.medicine_id = med.id
     WHERE med.dosage_unit LIKE '%/ml'
     GROUP BY med.id
  ) sub
 WHERE m.id = sub.id
   AND m.units_per_ml IS DISTINCT FROM sub.new_upm;

-- 3) Coluna concentration_volume_ml (FR-031/ADR-066): volume do rótulo (NULL = "por 1 mL").
--    Grants/RLS já existem na tabela (medicines pré-30/10/2026). Validação > 0 no Zod.
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS concentration_volume_ml NUMERIC DEFAULT NULL;

-- 4) RPC consume_stock_fifo — densidade gotas/UI unit-aware (FR-024). Corpo idêntico ao
--    live EXCETO: (a) SELECT traz units_per_ml cru (NULLIF, sem COALESCE 20); (b) ramos
--    gotas e UI separados com default 20/100. mg (dosage_per_pill) e ml inalterados.
CREATE OR REPLACE FUNCTION public.consume_stock_fifo(p_user_id uuid, p_medicine_id uuid, p_quantity numeric, p_medicine_log_id uuid)
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
  -- B3: units_per_ml cru (NULLIF 0→NULL); o default por unidade aplica no ramo gotas/UI.
  SELECT (dosage_unit LIKE '%/ml'), NULLIF(units_per_ml,0), dosage_per_pill
    INTO v_is_liquid, v_units_per_ml, v_concentration
    FROM public.medicines WHERE id=p_medicine_id;
  IF COALESCE(v_is_liquid,FALSE) THEN
    SELECT p.intake_unit INTO v_intake_unit FROM public.protocols p
      JOIN public.medicine_logs l ON l.protocol_id=p.id WHERE l.id=p_medicine_log_id;
    v_intake_unit := COALESCE(v_intake_unit,'ml');
    IF lower(v_intake_unit) = 'mg' THEN
      IF v_concentration IS NULL OR v_concentration <= 0 THEN
        RAISE EXCEPTION 'Concentração (mg/ml) do medicamento ausente — não dá para converter mg em ml';
      END IF;
      v_remaining := ROUND(p_quantity/v_concentration,2);
    ELSIF lower(v_intake_unit) = 'gotas' THEN
      v_remaining := ROUND(p_quantity/COALESCE(v_units_per_ml,20),2);
    ELSIF lower(v_intake_unit) = 'ui' THEN
      v_remaining := ROUND(p_quantity/COALESCE(v_units_per_ml,100),2);
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

-- Verificação pós-apply (rodar manualmente):
-- SELECT name, dosage_unit, units_per_ml FROM public.medicines WHERE dosage_unit LIKE '%/ml' ORDER BY name;
--   → Durateston/Xarope/Tresiba = NULL; Dipirona = 20; Lantus = 100; Mounjaro = NULL
-- SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='medicines' AND column_name='concentration_volume_ml'); → true
