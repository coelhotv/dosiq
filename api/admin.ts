// api/admin.js
// Entrypoint único consolidado para administração (DLQ + Feedbacks)
// Evita ultrapassar o limite de 12 Serverless Functions no plano Hobby da Vercel (R-090)

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { verifyAdminAccess } from '../server/utils/auth.js';
import { handleRetry } from './admin/_handlers/retry.js';
import { handleDiscard } from './admin/_handlers/discard.js';
import { handleListFeedbacks, handleResolveFeedback } from './admin/_handlers/feedbacks.js';
import { handleListNudges, handleCreateNudge, handleUpdateNudge, handleToggleNudge } from './admin/_handlers/nudges.js';
import { DLQStatus } from '../server/services/deadLetterQueue.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const adminChatId = process.env.ADMIN_CHAT_ID;

// Singleton client usando a service_role para operações de administração (inicializado com segurança)
const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, { realtime: { transport: /* TODO(040-strict): typar transport supabase realtime */ ws as any } })
  : null;

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

// Roteador auxiliar para recursos de DLQ.
async function _routeDlq(req, res, action) {
  if (req.method === 'GET' && !action) {
    return handleListDLQ(req, res);
  }
  if (req.method === 'POST') {
    if (action === 'retry') return handleRetry(req, res);
    if (action === 'discard') return handleDiscard(req, res);
  }
  return res.status(405).json({ error: 'Method or action not allowed for DLQ' });
}

// Roteador auxiliar para recursos de Feedbacks.
async function _routeFeedbacks(req, res, action) {
  if (req.method === 'GET' && !action) {
    return handleListFeedbacks(req, res);
  }
  if (req.method === 'POST') {
    if (action === 'resolve') return handleResolveFeedback(req, res);
  }
  return res.status(405).json({ error: 'Method or action not allowed for feedbacks' });
}

// Roteador auxiliar para recursos de Nudges.
async function _routeNudges(req, res, action, supabase) {
  if (req.method === 'GET' && !action) {
    return handleListNudges(req, res, supabase);
  }
  if (req.method === 'POST') {
    return handleCreateNudge(req, res, supabase);
  }
  if (req.method === 'PATCH') {
    return handleUpdateNudge(req, res, supabase);
  }
  if (req.method === 'PUT') {
    return handleToggleNudge(req, res, supabase);
  }
  return res.status(405).json({ error: 'Method or action not allowed for nudges' });
}

// Roteador auxiliar para health check (ENG-6, spec 043). Sem função serverless nova (R-090):
// vive como resource do admin. Reporta 'degraded' quando há pendências na notification_outbox
// mais velhas que o limite (fila entupida = drenador não vazando). Herda a auth de admin.
async function _routeHealth(req, res, scope, supabase) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed for health' });
  }
  if (scope !== 'notifications') {
    return res.status(400).json({ error: `Unknown health scope: ${scope}` });
  }
  const thresholdMin = Math.min(Math.max(parseInt(req.query.max_pending_age_min) || 15, 1), 240);
  // eslint-disable-next-line no-restricted-syntax -- aritmética de instante UTC absoluto, não parse de date-string
  const cutoff = new Date(Date.now() - thresholdMin * 60_000).toISOString();
  const { count, error } = await supabase
    .from('notification_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('created_at', cutoff);
  if (error) {
    console.error('[Admin API] health notifications query error:', error);
    return res.status(500).json({ status: 'error', error: 'Failed to query outbox health' });
  }
  const pendingAged = count || 0;
  const degraded = pendingAged > 0;
  return res.status(200).json({
    status: degraded ? 'degraded' : 'ok',
    scope: 'notifications',
    pendingAged,
    thresholdMin,
  });
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

  // resource: 'dlq' | 'feedbacks' | 'nudges' | 'health'
  // action: 'retry' | 'discard' | 'resolve'
  const { resource, action, scope } = req.query;

  if (resource === 'health') {
    return _routeHealth(req, res, scope, supabase);
  }

  if (resource === 'dlq') {
    return _routeDlq(req, res, action);
  }

  if (resource === 'feedbacks') {
    return _routeFeedbacks(req, res, action);
  }

  if (resource === 'nudges') {
    return _routeNudges(req, res, action, supabase);
  }

  return res.status(405).json({ error: 'Method or action not allowed' });
}
