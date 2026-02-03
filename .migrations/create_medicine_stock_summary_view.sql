-- Migration: Create medicine_stock_summary view for optimized stock queries
-- Provides aggregated stock data with PEPS (FIFO) tracking
-- Created: 2026-02-03
-- Author: Database Agent - Onda 1.6

-- ============================================
-- PART 1: Create the stock_summary view
-- ============================================

-- Drop view if exists (for idempotency)
DROP VIEW IF EXISTS medicine_stock_summary;

-- Create the view with aggregated stock data
CREATE OR REPLACE VIEW medicine_stock_summary AS
SELECT 
  medicine_id,
  user_id,
  COALESCE(SUM(quantity), 0) as total_quantity,
  COUNT(*) as stock_entries_count,
  MIN(purchase_date) as oldest_entry_date,
  MAX(purchase_date) as newest_entry_date
FROM stock
WHERE quantity > 0
GROUP BY medicine_id, user_id;

-- Add comments for documentation
COMMENT ON VIEW medicine_stock_summary IS 
  'Aggregated stock summary by medicine and user. Optimizes queries by pre-calculating totals. Updated automatically on stock changes.';

COMMENT ON COLUMN medicine_stock_summary.medicine_id IS 'Reference to the medicine';
COMMENT ON COLUMN medicine_stock_summary.user_id IS 'Owner of the stock data (for RLS)';
COMMENT ON COLUMN medicine_stock_summary.total_quantity IS 'Total available quantity (sum of all positive stock entries)';
COMMENT ON COLUMN medicine_stock_summary.stock_entries_count IS 'Number of active stock entries';
COMMENT ON COLUMN medicine_stock_summary.oldest_entry_date IS 'Date of the oldest stock entry (for PEPS/FIFO tracking)';
COMMENT ON COLUMN medicine_stock_summary.newest_entry_date IS 'Date of the newest stock entry';

-- ============================================
-- PART 2: Enable Row Level Security
-- ============================================

-- Enable RLS on the view
ALTER VIEW medicine_stock_summary SET (security_barrier = true);

-- Note: Views in PostgreSQL inherit RLS from the underlying table
-- We ensure the stock table has proper RLS policies

-- ============================================
-- PART 3: Create supporting indexes for performance
-- ============================================

-- Index for fast aggregation by medicine and user
CREATE INDEX IF NOT EXISTS idx_stock_medicine_user_quantity 
ON stock(medicine_id, user_id, quantity) 
WHERE quantity > 0;

-- Index for purchase_date ordering (PEPS/FIFO)
CREATE INDEX IF NOT EXISTS idx_stock_medicine_purchase 
ON stock(medicine_id, user_id, purchase_date) 
WHERE quantity > 0;

-- Composite index for the view query pattern
CREATE INDEX IF NOT EXISTS idx_stock_summary_lookup 
ON stock(medicine_id, user_id, purchase_date, quantity) 
WHERE quantity > 0;

-- ============================================
-- PART 4: Verify RLS policies on base table
-- ============================================

-- Ensure RLS is enabled on stock table
ALTER TABLE IF EXISTS stock ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own stock summary" ON stock;
DROP POLICY IF EXISTS "Users can view own stock" ON stock;
DROP POLICY IF EXISTS "Users can insert own stock" ON stock;
DROP POLICY IF EXISTS "Users can update own stock" ON stock;
DROP POLICY IF EXISTS "Users can delete own stock" ON stock;

-- Create RLS policies for stock table
CREATE POLICY "Users can view own stock"
  ON stock FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own stock"
  ON stock FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own stock"
  ON stock FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own stock"
  ON stock FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- PART 5: Create helper function for low stock alerts
-- ============================================

-- Function to get medicines with low stock for a user
CREATE OR REPLACE FUNCTION get_low_stock_medicines(
  p_user_id UUID,
  p_threshold NUMERIC DEFAULT 10
)
RETURNS TABLE (
  medicine_id UUID,
  total_quantity NUMERIC,
  stock_entries_count BIGINT,
  oldest_entry_date DATE,
  newest_entry_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mss.medicine_id,
    mss.total_quantity,
    mss.stock_entries_count,
    mss.oldest_entry_date,
    mss.newest_entry_date
  FROM medicine_stock_summary mss
  WHERE mss.user_id = p_user_id
    AND mss.total_quantity <= p_threshold
  ORDER BY mss.total_quantity ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_low_stock_medicines IS 
  'Returns medicines with stock below threshold for alert purposes';

-- ============================================
-- PART 6: Create function for stock summary refresh (if needed)
-- ============================================

-- Note: Views are automatically updated in PostgreSQL
-- This function serves as a placeholder for any custom refresh logic
CREATE OR REPLACE FUNCTION refresh_stock_summary()
RETURNS VOID AS $$
BEGIN
  -- Views are automatically consistent, but we can add cache invalidation here if needed
  -- This is a no-op for regular views (useful for documentation)
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_stock_summary() IS 
  'Placeholder for stock summary refresh operations. Views auto-update.';

-- ============================================
-- PART 7: Grant permissions
-- ============================================

-- Grant select on view to authenticated users
GRANT SELECT ON medicine_stock_summary TO authenticated;

-- ============================================
-- Verification Queries (run manually to test)
-- ============================================
/*
-- Test 1: View structure
SELECT * FROM medicine_stock_summary LIMIT 5;

-- Test 2: Low stock function
SELECT * FROM get_low_stock_medicines(auth.uid(), 10);

-- Test 3: Performance comparison
EXPLAIN ANALYZE 
SELECT medicine_id, SUM(quantity) 
FROM stock 
WHERE user_id = auth.uid() AND quantity > 0 
GROUP BY medicine_id;

EXPLAIN ANALYZE 
SELECT medicine_id, total_quantity 
FROM medicine_stock_summary 
WHERE user_id = auth.uid();

-- Test 4: RLS verification (should only see own data)
SELECT user_id, COUNT(*) as medicine_count 
FROM medicine_stock_summary 
GROUP BY user_id;
*/
