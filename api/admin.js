// api/admin.js
// Entrypoint único consolidado para administração (DLQ + Feedbacks)
// Evita ultrapassar o limite de 12 Serverless Functions no plano Hobby da Vercel (R-090)

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { verifyAdminAccess } from '../server/utils/auth.js';
import { handleRetry } from './admin/_handlers/retry.js';
import { handleDiscard } from './admin/_handlers/discard.js';
import { handleListFeedbacks, handleResolveFeedback } from './admin/_handlers/feedbacks.js';
import { DLQStatus } from '../server/services/deadLetterQueue.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const adminChatId = process.env.ADMIN_CHAT_ID;

// Singleton client usando a service_role para operações de administração
const supabase = createClient(supabaseUrl, supabaseServiceKey, { realtime: { transport: ws } });

/**
 * Handler: list DLQ (GET /api/dlq)
 */
async function handleListDLQ(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const status = req.query.status || null;

    const validStatuses = Object.values(DLQStatus);
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Valid values: ${validStatuses.join(', ')}`
      });
    }

    let query = supabase
      .from('failed_notification_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[DLQ API] Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch DLQ entries' });
    }

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
 * Main Router
 */
export default async function handler(req, res) {
  // Validate configurations
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || !adminChatId) {
    console.error('[Admin API] Missing configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify admin access
  const authResult = await verifyAdminAccess(req.headers['authorization']);
  if (!authResult.authorized) {
    console.error('[Admin API] Unauthorized access attempt:', authResult.error);
    return res.status(401).json({ error: authResult.error });
  }

  // resource: 'dlq' | 'feedbacks'
  // action: 'retry' | 'discard' | 'resolve'
  const { resource, action } = req.query;

  // 1. DLQ Resource Routing
  if (resource === 'dlq') {
    if (req.method === 'GET' && !action) {
      return handleListDLQ(req, res);
    }
    if (req.method === 'POST') {
      if (action === 'retry') return handleRetry(req, res);
      if (action === 'discard') return handleDiscard(req, res);
    }
  }

  // 2. Feedbacks Resource Routing
  if (resource === 'feedbacks') {
    if (req.method === 'GET' && !action) {
      return handleListFeedbacks(req, res);
    }
    if (req.method === 'POST') {
      if (action === 'resolve') return handleResolveFeedback(req, res);
    }
  }

  return res.status(405).json({ error: 'Method or action not allowed' });
}
