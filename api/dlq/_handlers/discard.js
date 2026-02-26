// api/dlq/_handlers/discard.js
// Dead Letter Queue Handler - Discard a failed notification
// NOTA: Este handler é chamado pelo router api/dlq.js, que já faz a autenticação
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../../../server/bot/logger.js';

const logger = createLogger('DLQDiscard');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Handler para descartar notificação da DLQ
 * @param {object} req - Request object (Vercel)
 * @param {object} res - Response object (Vercel)
 */
export async function handleDiscard(req, res) {
  // Get notification ID from query (router passa via req.query.id)
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
