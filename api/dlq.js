// api/dlq.js
// Dead Letter Queue Admin API - Router consolidado
// Rotas: GET /api/dlq (list) | POST /api/dlq?action=retry&id=:id | POST /api/dlq?action=discard&id=:id
import { createClient } from '@supabase/supabase-js';
import { DLQStatus } from '../server/services/deadLetterQueue.js';
import { verifyAdminAccess } from '../server/utils/auth.js';
import { handleRetry } from './dlq/_handlers/retry.js';
import { handleDiscard } from './dlq/_handlers/discard.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const adminChatId = process.env.ADMIN_CHAT_ID;

/**
 * Handler: list (GET /api/dlq)
 * Lista notificações falhas com paginação
 */
async function handleList(req, res) {
  // Create Supabase client with service role key (bypasses RLS for admin access)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse query parameters
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const status = req.query.status || null;

    // Validate status if provided
    const validStatuses = Object.values(DLQStatus);
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

/**
 * DLQ Router Handler
 * GET /api/dlq - List failed notifications with pagination
 * POST /api/dlq?action=retry&id=:id - Retry a specific notification
 * POST /api/dlq?action=discard&id=:id - Mark a notification as discarded
 *
 * Query params:
 * - limit: number of items per page (default: 20, max: 100)
 * - offset: offset for pagination (default: 0)
 * - status: filter by status (pending, retrying, resolved, discarded)
 * - action: 'retry' or 'discard' (POST only)
 * - id: UUID of the failed notification (POST only)
 *
 * Authentication:
 * - Requires Supabase Auth session token in Authorization header
 * - User must have telegram_chat_id matching ADMIN_CHAT_ID
 */
export default async function handler(req, res) {
  // Validate environment variables
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || !adminChatId) {
    console.error('[DLQ API] Missing configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify admin access (compartilhada entre todos os endpoints)
  const authResult = await verifyAdminAccess(req.headers['authorization']);
  if (!authResult.authorized) {
    console.error('[DLQ API] Unauthorized access attempt:', authResult.error);
    return res.status(401).json({ error: authResult.error });
  }

  const { action } = req.query;
  const { method } = req;

  // Roteamento baseado em método e action
  if (method === 'GET' && !action) {
    return handleList(req, res);
  }

  if (method === 'POST' && action === 'retry') {
    return handleRetry(req, res);
  }

  if (method === 'POST' && action === 'discard') {
    return handleDiscard(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
