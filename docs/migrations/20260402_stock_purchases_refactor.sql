-- docs/migrations/20260402_stock_purchases_refactor.sql
-- ==========================================================
-- Stock Purchases Refactor (redesign-first rollout)
-- Data: 2026-04-02
-- Objetivo:
--   1. Separar compra histórica de saldo de estoque
--   2. Preservar FIFO com trilha exata de consumo por lote
--   3. Permitir restauração idempotente ao excluir/editar logs
--   4. Adicionar regulatory_category em medicines (ANVISA)
--   5. Fazer backfill idempotente do modelo legado
-- ==========================================================

BEGIN;

-- ==========================================================
-- PARTE 1: Expand schema
-- ==========================================================

ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS regulatory_category TEXT;

CREATE INDEX IF NOT EXISTS idx_medicines_user_regulatory_category
  ON public.medicines(user_id, regulatory_category)
  WHERE regulatory_category IS NOT NULL;

ALTER TABLE public.stock
  ADD COLUMN IF NOT EXISTS purchase_id UUID,
  ADD COLUMN IF NOT EXISTS original_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS entry_type TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.stock
SET
  entry_type = COALESCE(entry_type, 'purchase'),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE entry_type IS NULL
   OR updated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  quantity_bought NUMERIC NOT NULL CHECK (quantity_bought > 0),
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  purchase_date DATE NOT NULL,
  expiration_date DATE NULL,
  pharmacy TEXT NULL,
  laboratory TEXT NULL,
  notes TEXT NULL,
  legacy_stock_id UUID NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchases_expiration_after_purchase_check
    CHECK (expiration_date IS NULL OR expiration_date > purchase_date)
);

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  stock_id UUID NULL REFERENCES public.stock(id) ON DELETE SET NULL,
  quantity_delta NUMERIC NOT NULL CHECK (quantity_delta <> 0),
  reason TEXT NOT NULL,
  reference_id UUID NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_log_id UUID NOT NULL REFERENCES public.medicine_logs(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES public.stock(id) ON DELETE CASCADE,
  quantity_consumed NUMERIC NOT NULL CHECK (quantity_consumed > 0),
  reversed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_entry_type_check'
      AND conrelid = 'public.stock'::regclass
  ) THEN
    ALTER TABLE public.stock
      ADD CONSTRAINT stock_entry_type_check
      CHECK (entry_type IN ('purchase', 'adjustment', 'legacy_unrecoverable'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_purchase_id_fkey'
      AND conrelid = 'public.stock'::regclass
  ) THEN
    ALTER TABLE public.stock
      ADD CONSTRAINT stock_purchase_id_fkey
      FOREIGN KEY (purchase_id)
      REFERENCES public.purchases(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_fifo_available
  ON public.stock(user_id, medicine_id, purchase_date, created_at, id)
  WHERE quantity > 0;

CREATE INDEX IF NOT EXISTS idx_purchases_user_medicine_purchase_date_desc
  ON public.purchases(user_id, medicine_id, purchase_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_user_medicine_created_desc
  ON public.stock_adjustments(user_id, medicine_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_consumptions_user_log
  ON public.stock_consumptions(user_id, medicine_log_id);

CREATE INDEX IF NOT EXISTS idx_stock_consumptions_active_stock
  ON public.stock_consumptions(stock_id)
  WHERE reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_purchase_id
  ON public.stock(purchase_id)
  WHERE purchase_id IS NOT NULL;

-- ==========================================================
-- PARTE 2: updated_at trigger em stock
-- ==========================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_stock_updated_at ON public.stock;

CREATE TRIGGER set_stock_updated_at
  BEFORE UPDATE ON public.stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================================
-- PARTE 3: RLS
-- ==========================================================

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_consumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can update own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can delete own purchases" ON public.purchases;

CREATE POLICY "Users can view own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchases"
  ON public.purchases FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchases"
  ON public.purchases FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own stock adjustments" ON public.stock_adjustments;
DROP POLICY IF EXISTS "Users can insert own stock adjustments" ON public.stock_adjustments;
DROP POLICY IF EXISTS "Users can update own stock adjustments" ON public.stock_adjustments;
DROP POLICY IF EXISTS "Users can delete own stock adjustments" ON public.stock_adjustments;

CREATE POLICY "Users can view own stock adjustments"
  ON public.stock_adjustments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stock adjustments"
  ON public.stock_adjustments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stock adjustments"
  ON public.stock_adjustments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stock adjustments"
  ON public.stock_adjustments FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own stock consumptions" ON public.stock_consumptions;
DROP POLICY IF EXISTS "Users can insert own stock consumptions" ON public.stock_consumptions;
DROP POLICY IF EXISTS "Users can update own stock consumptions" ON public.stock_consumptions;
DROP POLICY IF EXISTS "Users can delete own stock consumptions" ON public.stock_consumptions;

CREATE POLICY "Users can view own stock consumptions"
  ON public.stock_consumptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stock consumptions"
  ON public.stock_consumptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stock consumptions"
  ON public.stock_consumptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stock consumptions"
  ON public.stock_consumptions FOR DELETE
  USING (auth.uid() = user_id);

-- ==========================================================
-- PARTE 4: Backfill idempotente
-- ==========================================================

UPDATE public.stock
SET
  entry_type = 'adjustment',
  original_quantity = COALESCE(original_quantity, quantity)
WHERE entry_type = 'purchase'
  AND (
    notes LIKE 'Dose excluída%'
    OR notes LIKE 'Ajuste de dose%'
    OR notes LIKE 'Estorno de dose%'
  );

INSERT INTO public.stock_adjustments (
  user_id,
  medicine_id,
  stock_id,
  quantity_delta,
  reason,
  reference_id,
  notes,
  created_at
)
SELECT
  s.user_id,
  s.medicine_id,
  s.id,
  s.quantity,
  CASE
    WHEN s.notes LIKE 'Dose excluída%' THEN 'dose_deleted_restore'
    WHEN s.notes LIKE 'Ajuste de dose%' THEN 'dose_update_restore'
    WHEN s.notes LIKE 'Estorno de dose%' THEN 'legacy_stock_restore'
    ELSE 'legacy_adjustment'
  END AS reason,
  NULL,
  s.notes,
  COALESCE(s.created_at, NOW())
FROM public.stock s
LEFT JOIN public.stock_adjustments sa
  ON sa.stock_id = s.id
WHERE s.entry_type = 'adjustment'
  AND s.quantity <> 0
  AND (
    s.notes LIKE 'Dose excluída%'
    OR s.notes LIKE 'Ajuste de dose%'
    OR s.notes LIKE 'Estorno de dose%'
  )
  AND sa.id IS NULL;

INSERT INTO public.purchases (
  user_id,
  medicine_id,
  quantity_bought,
  unit_price,
  purchase_date,
  expiration_date,
  pharmacy,
  laboratory,
  notes,
  legacy_stock_id,
  created_at
)
SELECT
  s.user_id,
  s.medicine_id,
  s.quantity,
  COALESCE(s.unit_price, 0),
  COALESCE(s.purchase_date, COALESCE(s.created_at, NOW())::date),
  s.expiration_date,
  NULL,
  NULL,
  s.notes,
  s.id,
  COALESCE(s.created_at, NOW())
FROM public.stock s
LEFT JOIN public.purchases p
  ON p.legacy_stock_id = s.id
WHERE s.quantity > 0
  AND s.entry_type = 'purchase'
  AND p.id IS NULL;

UPDATE public.stock s
SET
  purchase_id = p.id,
  original_quantity = COALESCE(s.original_quantity, s.quantity),
  entry_type = 'purchase'
FROM public.purchases p
WHERE p.legacy_stock_id = s.id
  AND (s.purchase_id IS DISTINCT FROM p.id OR s.original_quantity IS NULL);

UPDATE public.stock
SET
  entry_type = 'legacy_unrecoverable',
  original_quantity = COALESCE(original_quantity, quantity)
WHERE purchase_id IS NULL
  AND entry_type = 'purchase'
  AND quantity <= 0;

UPDATE public.stock
SET original_quantity = quantity
WHERE entry_type = 'purchase'
  AND purchase_id IS NOT NULL
  AND original_quantity IS NULL;

-- ==========================================================
-- PARTE 5: RPCs
-- ==========================================================

CREATE OR REPLACE FUNCTION public.create_purchase_with_stock(
  p_medicine_id UUID,
  p_quantity NUMERIC,
  p_unit_price NUMERIC DEFAULT 0,
  p_purchase_date DATE DEFAULT CURRENT_DATE,
  p_expiration_date DATE DEFAULT NULL,
  p_pharmacy TEXT DEFAULT NULL,
  p_laboratory TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_purchase public.purchases%ROWTYPE;
  v_stock public.stock%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade da compra deve ser maior que zero';
  END IF;

  IF COALESCE(p_unit_price, 0) < 0 THEN
    RAISE EXCEPTION 'Preço unitário não pode ser negativo';
  END IF;

  IF p_expiration_date IS NOT NULL AND p_expiration_date <= p_purchase_date THEN
    RAISE EXCEPTION 'Data de validade deve ser posterior à data da compra';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.medicines
    WHERE id = p_medicine_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Medicamento não encontrado para o usuário autenticado';
  END IF;

  INSERT INTO public.purchases (
    user_id,
    medicine_id,
    quantity_bought,
    unit_price,
    purchase_date,
    expiration_date,
    pharmacy,
    laboratory,
    notes
  )
  VALUES (
    v_user_id,
    p_medicine_id,
    p_quantity,
    COALESCE(p_unit_price, 0),
    COALESCE(p_purchase_date, CURRENT_DATE),
    p_expiration_date,
    NULLIF(TRIM(p_pharmacy), ''),
    NULLIF(TRIM(p_laboratory), ''),
    NULLIF(TRIM(p_notes), '')
  )
  RETURNING * INTO v_purchase;

  INSERT INTO public.stock (
    medicine_id,
    quantity,
    purchase_date,
    expiration_date,
    unit_price,
    notes,
    user_id,
    purchase_id,
    original_quantity,
    entry_type
  )
  VALUES (
    p_medicine_id,
    p_quantity,
    v_purchase.purchase_date,
    v_purchase.expiration_date,
    v_purchase.unit_price,
    v_purchase.notes,
    v_user_id,
    v_purchase.id,
    p_quantity,
    'purchase'
  )
  RETURNING * INTO v_stock;

  RETURN jsonb_build_object(
    'purchase', to_jsonb(v_purchase),
    'stock', to_jsonb(v_stock)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_stock_fifo(
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
  v_user_id UUID := auth.uid();
  v_remaining NUMERIC := p_quantity;
  v_total_available NUMERIC := 0;
  v_total_consumed NUMERIC := 0;
  v_rows_consumed INTEGER := 0;
  v_to_consume NUMERIC;
  v_stock_row public.stock%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
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
    RAISE EXCEPTION 'Log de medicamento não encontrado para o usuário autenticado';
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

CREATE OR REPLACE FUNCTION public.restore_stock_for_log(
  p_medicine_log_id UUID,
  p_reason TEXT DEFAULT 'dose_deleted_restore'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_restored_total NUMERIC := 0;
  v_restored_rows INTEGER := 0;
  v_consumption RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_medicine_log_id IS NULL THEN
    RAISE EXCEPTION 'medicine_log_id é obrigatório';
  END IF;

  FOR v_consumption IN
    SELECT sc.*, s.medicine_id
    FROM public.stock_consumptions sc
    JOIN public.stock s
      ON s.id = sc.stock_id
    WHERE sc.user_id = v_user_id
      AND sc.medicine_log_id = p_medicine_log_id
      AND sc.reversed_at IS NULL
    ORDER BY sc.created_at ASC, sc.id ASC
    FOR UPDATE OF sc, s
  LOOP
    UPDATE public.stock
    SET quantity = quantity + v_consumption.quantity_consumed
    WHERE id = v_consumption.stock_id;

    UPDATE public.stock_consumptions
    SET reversed_at = NOW()
    WHERE id = v_consumption.id
      AND reversed_at IS NULL;

    INSERT INTO public.stock_adjustments (
      user_id,
      medicine_id,
      stock_id,
      quantity_delta,
      reason,
      reference_id,
      notes
    )
    VALUES (
      v_user_id,
      v_consumption.medicine_id,
      v_consumption.stock_id,
      v_consumption.quantity_consumed,
      COALESCE(NULLIF(TRIM(p_reason), ''), 'dose_deleted_restore'),
      p_medicine_log_id,
      'Restauração automática de estoque por reversão de log'
    );

    v_restored_total := v_restored_total + v_consumption.quantity_consumed;
    v_restored_rows := v_restored_rows + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'medicine_log_id', p_medicine_log_id,
    'quantity_restored', v_restored_total,
    'restored_rows', v_restored_rows,
    'already_restored', (v_restored_rows = 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_manual_stock_adjustment(
  p_medicine_id UUID,
  p_quantity_delta NUMERIC,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_stock public.stock%ROWTYPE;
  v_adjustment public.stock_adjustments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity_delta IS NULL OR p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'Quantidade do ajuste deve ser diferente de zero';
  END IF;

  IF p_quantity_delta < 0 THEN
    RAISE EXCEPTION 'Ajuste manual negativo não é permitido nesta entrega';
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

  INSERT INTO public.stock (
    medicine_id,
    quantity,
    purchase_date,
    expiration_date,
    unit_price,
    notes,
    user_id,
    purchase_id,
    original_quantity,
    entry_type
  )
  VALUES (
    p_medicine_id,
    p_quantity_delta,
    CURRENT_DATE,
    NULL,
    0,
    NULLIF(TRIM(p_notes), ''),
    v_user_id,
    NULL,
    p_quantity_delta,
    'adjustment'
  )
  RETURNING * INTO v_stock;

  INSERT INTO public.stock_adjustments (
    user_id,
    medicine_id,
    stock_id,
    quantity_delta,
    reason,
    reference_id,
    notes
  )
  VALUES (
    v_user_id,
    p_medicine_id,
    v_stock.id,
    p_quantity_delta,
    NULLIF(TRIM(p_reason), ''),
    NULL,
    NULLIF(TRIM(p_notes), '')
  )
  RETURNING * INTO v_adjustment;

  RETURN jsonb_build_object(
    'stock', to_jsonb(v_stock),
    'adjustment', to_jsonb(v_adjustment)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase_with_stock(UUID, NUMERIC, NUMERIC, DATE, DATE, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_stock_fifo(UUID, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_stock_for_log(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_manual_stock_adjustment(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

COMMIT;

-- ==========================================================
-- VERIFICAÇÃO MANUAL PÓS-MIGRAÇÃO
-- ==========================================================
-- 1. Saldo preservado por usuário/medicamento:
--    SELECT user_id, medicine_id, SUM(quantity) FROM stock GROUP BY 1, 2;
--
-- 2. Purchases backfilladas:
--    SELECT COUNT(*) FROM purchases WHERE legacy_stock_id IS NOT NULL;
--
-- 3. Stock purchase-linked:
--    SELECT COUNT(*) FROM stock WHERE entry_type = 'purchase' AND purchase_id IS NULL;
--
-- 4. Legacy irrecoverable:
--    SELECT COUNT(*) FROM stock WHERE entry_type = 'legacy_unrecoverable';
