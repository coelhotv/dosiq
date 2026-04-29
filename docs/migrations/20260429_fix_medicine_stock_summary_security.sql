-- docs/migrations/20260429_fix_medicine_stock_summary_security.sql
-- ==========================================================
-- Corrige alerta Supabase 0010_security_definer_view
-- Objeto: public.medicine_stock_summary
--
-- Motivo:
--   Views PostgreSQL usam permissões/RLS do owner por padrão. Em Supabase,
--   views expostas ao client devem usar security_invoker para aplicar RLS
--   como o usuário autenticado que executa a query.
-- ==========================================================

BEGIN;

CREATE OR REPLACE VIEW public.medicine_stock_summary
WITH (security_invoker = on, security_barrier = true) AS
SELECT
  medicine_id,
  user_id,
  COALESCE(SUM(quantity), 0) AS total_quantity,
  COUNT(*) AS stock_entries_count,
  MIN(purchase_date) AS oldest_entry_date,
  MAX(purchase_date) AS newest_entry_date
FROM public.stock
WHERE quantity > 0
GROUP BY medicine_id, user_id;

COMMENT ON VIEW public.medicine_stock_summary IS
  'Aggregated stock summary by medicine and user. Uses security_invoker so stock RLS is evaluated as the querying user.';

COMMENT ON COLUMN public.medicine_stock_summary.medicine_id IS 'Reference to the medicine';
COMMENT ON COLUMN public.medicine_stock_summary.user_id IS 'Owner of the stock data (for RLS)';
COMMENT ON COLUMN public.medicine_stock_summary.total_quantity IS 'Total available quantity (sum of all positive stock entries)';
COMMENT ON COLUMN public.medicine_stock_summary.stock_entries_count IS 'Number of active stock entries';
COMMENT ON COLUMN public.medicine_stock_summary.oldest_entry_date IS 'Date of the oldest stock entry (for PEPS/FIFO tracking)';
COMMENT ON COLUMN public.medicine_stock_summary.newest_entry_date IS 'Date of the newest stock entry';

ALTER TABLE IF EXISTS public.stock ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.medicine_stock_summary TO authenticated;

CREATE OR REPLACE FUNCTION public.get_low_stock_medicines(
  p_user_id UUID,
  p_threshold NUMERIC DEFAULT 10
)
RETURNS TABLE (
  medicine_id UUID,
  total_quantity NUMERIC,
  stock_entries_count BIGINT,
  oldest_entry_date DATE,
  newest_entry_date DATE
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Usuário não autorizado'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    mss.medicine_id,
    mss.total_quantity,
    mss.stock_entries_count,
    mss.oldest_entry_date,
    mss.newest_entry_date
  FROM public.medicine_stock_summary mss
  WHERE mss.user_id = auth.uid()
    AND mss.total_quantity <= p_threshold
  ORDER BY mss.total_quantity ASC;
END;
$$;

COMMENT ON FUNCTION public.get_low_stock_medicines(UUID, NUMERIC) IS
  'Returns medicines with stock below threshold for the authenticated user. SECURITY INVOKER preserves RLS.';

COMMIT;
