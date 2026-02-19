// api/dlq/[id]/discard.js
// Dead Letter Queue Admin API - Discard a failed notification
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../../../server/bot/logger.js';

const logger = createLogger('DLQDiscard');

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
    logger.error('Erro na verificação de admin', err);
    return { authorized: false, error: 'Erro interno na verificação de acesso' };
  }
}

/**
 * DLQ Discard API Handler
 * POST /api/dlq/[id]/discard - Mark a notification as discarded
 * 
 * Path params:
 * - id: UUID of the failed notification
 * 
 * Body params (optional):
 * - reason: Reason for discarding (stored in resolution_notes)
 * 
 * Authentication:
 * - Requires Supabase Auth session token in Authorization header
 * - User must have telegram_chat_id matching ADMIN_CHAT_ID
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Validate environment variables
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || !adminChatId) {
    logger.error('Missing configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify admin access
  const authResult = await verifyAdminAccess(req.headers['authorization']);
  if (!authResult.authorized) {
    logger.error('Unauthorized access attempt:', authResult.error);
    return res.status(401).json({ error: authResult.error });
  }

  // Get notification ID from path
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing notification ID' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid notification ID format' });
  }

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch the failed notification
    const { data: notification, error: fetchError } = await supabase
      .from('failed_notification_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      logger.error('Notification not found', fetchError, { id });
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if notification can be discarded
    if (notification.status === 'resolved') {
      return res.status(400).json({ error: 'Notification already resolved' });
    }

    if (notification.status === 'discarded') {
      return res.status(400).json({ error: 'Notification already discarded' });
    }

    // Get reason from request body (optional)
    const reason = req.body?.reason || 'Discarded via admin interface';

    // Mark as discarded
    const { error: updateError } = await supabase
      .from('failed_notification_queue')
      .update({
        status: 'discarded',
        resolved_at: new Date().toISOString(),
        resolution_notes: reason
      })
      .eq('id', id);

    if (updateError) {
      logger.error('Failed to discard notification', updateError, { id });
      return res.status(500).json({ error: 'Failed to discard notification' });
    }

    logger.info('Notification discarded', { 
      id, 
      reason,
      previousStatus: notification.status 
    });

    return res.status(200).json({
      success: true,
      message: 'Notification discarded successfully'
    });

  } catch (err) {
    logger.error('Unexpected error during discard', err, { id });
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}
