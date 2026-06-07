-- ============================================================================
-- Migration: Medicamentos Líquidos (Épico 022) — Fase A (DB/Backend)
-- Data: 2026-06-07
-- Spec: plans/specs/022-liquid-medications/{spec,plan,analysis}.md
-- Decisão-mãe: líquido := dosage_unit LIKE '%/ml' (não booleano is_liquid).
-- Coordenação 012 (ADR-058): units_per_ml genérica (razão→ml) + presentation.
--
-- Idempotente: rodar 2× = no-op.
-- Ordem: (A.1) CHECK dosage_unit → (A.2) colunas+checks → (A.3) migração dados
--        → (A.4) RPC consume_stock_fifo 4-arg líquida + DROP overload 3-arg.
--
-- Evidência DB ao vivo (C1/T001, projeto kwqjtdsqkkbebfiaxubb):
--   - dosage_unit: text livre, SEM CHECK (default 'mg'). Valores: mg(88) ui(3)
--     ml(3) un(2) g(2) mcg(1); ZERO 'gotas'. A.1 = ADD (não drop/recreate).
--   - units_per_ml / presentation / protocols.intake_unit: ausentes (NEW).
--   - stock.quantity numeric NOT NULL, sem negativos (CHECK seguro).
--   - consume_stock_fifo: 2 overloads (3-arg auth.uid() + 4-arg p_user_id).
--     Callers: doseActions.js (4-arg), medicineLogService.js (4-arg),
--     conversational.js (3-arg → migrado p/ 4-arg neste épico). DROP 3-arg.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- A.1 — CHECK de unidades de concentração (ADD; não existia)
-- Set legacy-safe: mantém ml/gotas até a migração A.3 zerar o uso de ml.
-- O form (Fase C) deixa de oferecer ml/gotas como concentração.
-- ----------------------------------------------------------------------------
ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_dosage_unit_check;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_dosage_unit_check
  CHECK (dosage_unit IN ('mg','mcg','g','ml','ui','un','gotas','mg/ml','ui/ml'));

-- ----------------------------------------------------------------------------
-- A.2 — Colunas estruturais + check de saldo
-- ----------------------------------------------------------------------------
-- Coluna genérica de densidade/razão→ml (ADR-058; ex-drops_per_ml).
-- Significado adapta-se à dosage_unit: gotas=20 (gotas/ml), ui/ml=100 (U-100), ml=1.
-- Conversão no decremento: ml = p_quantity / units_per_ml (quando intake_unit='gotas').
-- NUMERIC (não INTEGER) p/ futuras concentrações fracionárias; default 20 serve gotas.
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS units_per_ml NUMERIC DEFAULT 20;

-- Forma farmacêutica explícita (additiva — ADR-058; alinha MEDICINE_TYPES).
-- NÃO substitui is_liquid derivado (decisão-mãe). Eixo de forma que a 012 estende.
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS presentation TEXT DEFAULT 'comprimido';
ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS medicines_presentation_check;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_presentation_check
  CHECK (presentation IN ('comprimido','capsula','liquido','injecao','pomada','spray','outro'));

-- Unidade física da tomada (gotas/ml/UI; NULL p/ sólidos).
ALTER TABLE public.protocols ADD COLUMN IF NOT EXISTS intake_unit TEXT DEFAULT NULL;

-- Saldo não-negativo (sem negativos hoje — verificado).
ALTER TABLE public.stock DROP CONSTRAINT IF EXISTS chk_stock_quantity_non_negative;
ALTER TABLE public.stock ADD CONSTRAINT chk_stock_quantity_non_negative CHECK (quantity >= 0);

-- Colunas em tabelas existentes não exigem novos GRANTs (regra vale p/ CREATE TABLE). RLS preservada.

-- ----------------------------------------------------------------------------
-- A.3 — Migração de dados (ml/gotas → mg/ml + intake_unit + presentation)
-- Idempotente. Hoje só há 3 linhas 'ml' (zero 'gotas').
-- ----------------------------------------------------------------------------
-- 3a. Move a unidade de tomada antiga p/ os protocolos do medicamento líquido legado.
UPDATE public.protocols p
SET intake_unit = m.dosage_unit          -- 'ml' ou 'gotas'
FROM public.medicines m
WHERE p.medicine_id = m.id
  AND m.dosage_unit IN ('ml','gotas')
  AND p.intake_unit IS NULL;

-- 3b. Converte a unidade do medicamento p/ o modelo de concentração.
UPDATE public.medicines
SET dosage_unit  = 'mg/ml',
    units_per_ml = COALESCE(units_per_ml, 20),
    presentation = 'liquido'
WHERE dosage_unit IN ('ml','gotas');

-- 3c. Backfill de presentation p/ remanescentes sem valor (default cobre novas; legados NULL → comprimido).
UPDATE public.medicines
SET presentation = 'comprimido'
WHERE presentation IS NULL;

-- dosage_per_pill deixado como está (NULL p/ legados; massa ativa só exibida quando preenchida).
-- 'ui' líquido legado (raríssimo, ambíguo vs sólido 'ui') NÃO convertido automaticamente — revisão manual.

-- ----------------------------------------------------------------------------
-- A.4 — RPC consume_stock_fifo (4-arg, sobrecarga líquida) + DROP overload 3-arg
-- D1 (operador): migrar caller p/ 4-arg + DROP 3-arg (conversational.js editado).
-- D2 (operador): manter FIFO purchase_date (sem FEFO).
-- Preserva G2 (filtro entry_type != 'legacy_unrecoverable') + G3 (guard medicine_logs).
-- Hardening: SET search_path = '' + refs public. qualificadas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_stock_fifo(
  p_user_id UUID,
  p_medicine_id UUID,
  p_quantity NUMERIC,          -- dose na unidade de tomada (líquidos); unidades (sólidos)
  p_medicine_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := p_user_id;
  v_is_liquid BOOLEAN;
  v_units_per_ml NUMERIC;       -- razão→ml genérica (gotas/ml=20, UI/ml=100); ex-drops_per_ml
  v_intake_unit TEXT;
  v_remaining NUMERIC;
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

  -- Guard de posse (G3): log pertence ao user e ao medicamento.
  IF NOT EXISTS (
    SELECT 1
    FROM public.medicine_logs
    WHERE id = p_medicine_log_id
      AND medicine_id = p_medicine_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Log de medicamento não encontrado para o usuário';
  END IF;

  -- Detecção de líquido pela unidade de concentração (decisão-mãe).
  SELECT (dosage_unit LIKE '%/ml'), COALESCE(units_per_ml, 20)
  INTO v_is_liquid, v_units_per_ml
  FROM public.medicines
  WHERE id = p_medicine_id;

  IF COALESCE(v_is_liquid, FALSE) THEN
    -- intake_unit do protocolo vinculado ao log.
    SELECT p.intake_unit INTO v_intake_unit
    FROM public.protocols p
    JOIN public.medicine_logs l ON l.protocol_id = p.id
    WHERE l.id = p_medicine_log_id;

    IF v_intake_unit = 'gotas' THEN
      v_remaining := ROUND(p_quantity / v_units_per_ml, 2);   -- gotas → ml
    ELSE
      v_remaining := ROUND(p_quantity, 2);                    -- 'ml', 'UI' (v1 escala direta), fallback
    END IF;
    -- NOTA (012): insulina basal estende o branch 'UI' p/ converter via v_units_per_ml. Fora do escopo 022.
  ELSE
    v_remaining := p_quantity;                                -- sólidos: linear inteiro
  END IF;

  -- Disponibilidade (G2: exclui legacy_unrecoverable).
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_available
  FROM public.stock
  WHERE medicine_id = p_medicine_id
    AND user_id = v_user_id
    AND quantity > 0
    AND entry_type != 'legacy_unrecoverable';

  IF v_total_available < v_remaining THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  -- FIFO por purchase_date (D2: mantém ordem atual; sem FEFO).
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

    INSERT INTO public.stock_consumptions (
      user_id, medicine_log_id, medicine_id, stock_id, quantity_consumed
    )
    VALUES (
      v_user_id, p_medicine_log_id, p_medicine_id, v_stock_row.id, v_to_consume
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
    'is_liquid', v_is_liquid,
    'quantity_requested', p_quantity,
    'quantity_consumed', v_total_consumed,
    'consumption_rows_created', v_rows_consumed
  );
END;
$$;

-- SECURITY DEFINER hardening (CLAUDE.md).
REVOKE EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, UUID, NUMERIC, UUID) TO authenticated, service_role;

-- DROP do overload legacy 3-arg (D1). Caller único (conversational.js) migrado p/ 4-arg.
DROP FUNCTION IF EXISTS public.consume_stock_fifo(UUID, NUMERIC, UUID);

COMMIT;

-- ----------------------------------------------------------------------------
-- Validação pós-migração (rodar manualmente após COMMIT):
--   SELECT count(*) FROM public.medicines WHERE dosage_unit IN ('ml','gotas');  -- → 0
--   SELECT proname, pg_get_function_identity_arguments(oid)
--     FROM pg_proc WHERE proname='consume_stock_fifo';                          -- → só a 4-arg
-- ----------------------------------------------------------------------------
