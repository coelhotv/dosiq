// api/dlq.js
// Dead Letter Queue Admin API - List failed notifications
import { createClient } from '@supabase/supabase-js';
import { DLQStatus } from '../server/services/deadLetterQueue.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const adminChatId = process.env.ADMIN_CHAT_ID;

/**
 * Verifica se o usuário autenticado é um administrador
 * @param {string} authHeader - Header de autorização com Bearer token
 * @returns {Promise<{authorized: boolean, error?: string, userId?: string}>}
 */
async function verifyAdminAccess(authHeader) {
  // Verificar se o header existe
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Token de autorização não fornecido' };
  }

  const token = authHeader.replace('Bearer ', '');

  // Criar cliente Supabase com o token do usuário
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });

  try {
    // Verificar o token e obter o usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { authorized: false, error: 'Token inválido ou expirado' };
    }

    // Buscar o telegram_chat_id do usuário
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('telegram_chat_id')
      .eq('user_id', user.id)
      .single();

    if (settingsError || !userSettings?.telegram_chat_id) {
      return { authorized: false, error: 'Configurações de usuário não encontradas' };
    }

    // Verificar se o telegram_chat_id corresponde ao ADMIN_CHAT_ID
    if (userSettings.telegram_chat_id !== adminChatId) {
      return { authorized: false, error: 'Acesso negado. Apenas administradores podem acessar.' };
    }

    return { authorized: true, userId: user.id };
  } catch (err) {
    console.error('[DLQ API] Erro na verificação de admin:', err);
    return { authorized: false, error: 'Erro interno na verificação de acesso' };
  }
}

/**
 * DLQ Admin API Handler
 * GET /api/dlq - List failed notifications with pagination
 * 
 * Query params:
 * - limit: number of items per page (default: 20, max: 100)
 * - offset: offset for pagination (default: 0)
 * - status: filter by status (pending, retrying, resolved, discarded)
 * 
 * Authentication:
 * - Requires Supabase Auth session token in Authorization header
 * - User must have telegram_chat_id matching ADMIN_CHAT_ID
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // Validate environment variables
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || !adminChatId) {
    console.error('[DLQ API] Missing configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify admin access
  const authResult = await verifyAdminAccess(req.headers['authorization']);
  if (!authResult.authorized) {
    console.error('[DLQ API] Unauthorized access attempt:', authResult.error);
    return res.status(401).json({ error: authResult.error });
  }

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
