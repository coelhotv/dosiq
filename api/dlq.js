// api/dlq.js
// Dead Letter Queue Admin API - List failed notifications
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * DLQ Admin API Handler
 * GET /api/dlq - List failed notifications with pagination
 * 
 * Query params:
 * - limit: number of items per page (default: 20, max: 100)
 * - offset: offset for pagination (default: 0)
 * - status: filter by status (pending, retrying, resolved, discarded)
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // Validate environment variables
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[DLQ API] Missing Supabase configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Create Supabase client with service role key (bypasses RLS for admin access)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse query parameters
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const status = req.query.status || null;

    // Validate status if provided
    const validStatuses = ['pending', 'retrying', 'resolved', 'discarded', 'failed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Valid values: ${validStatuses.join(', ')}` 
      });
    }

    // Build query
    let query = supabase
      .from('failed_notification_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[DLQ API] Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch DLQ entries' });
    }

    // Return paginated response
    return res.status(200).json({
      data: data || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit)
    });

  } catch (err) {
    console.error('[DLQ API] Unexpected error:', err);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}
