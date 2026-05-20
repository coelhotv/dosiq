-- 20260520_purchases_unit_price_precision.sql
--
-- Corrige regressão do refactor de estoque (20260402): purchases.unit_price
-- ficou NUMERIC(10,2) enquanto stock.unit_price é NUMERIC(12,4). Custos muito
-- baixos (genéricos/fracionados, ex. R$ 0,134 por comprimido) eram arredondados
-- silenciosamente para 2 casas no INSERT.
--
-- Alinha purchases.unit_price a NUMERIC(12,4) — mesma escala de stock.
-- Suporta no mínimo 3 casas decimais (4 efetivas). CHECK (>= 0) e DEFAULT 0
-- permanecem válidos (tipo compatível, sem perda de dados — apenas amplia escala).
--
-- Idempotente: só altera se a escala atual for diferente de 4.
-- Aplicação manual pelo PO (Wave 5).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchases'
      AND column_name = 'unit_price'
      AND numeric_scale <> 4
  ) THEN
    ALTER TABLE public.purchases
      ALTER COLUMN unit_price TYPE NUMERIC(12, 4);
  END IF;
END $$;
