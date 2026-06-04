// api/admin/_handlers/feedbacks.js
// Handlers para gerenciamento de feedbacks no painel administrativo

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { createLogger } from '../../../server/bot/logger.js';
import { getServerTimestamp } from '../../../packages/core/src/utils/dateUtils.js';

const logger = createLogger('FeedbacksAdmin');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente Supabase instanciado com Service Role para bypass de RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, { realtime: { transport: ws } });

/**
 * handleListFeedbacks: GET /api/feedbacks
 * Lista feedbacks com suporte a paginação e filtros por is_resolved e rating
 */
export async function handleListFeedbacks(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const isResolved = req.query.is_resolved;
    const rating = req.query.rating;

    // Conecta feedbacks ao display_name do usuário em user_settings
    let query = supabase
      .from('feedbacks')
      .select('*, user_settings:user_id(display_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (isResolved !== undefined) {
      query = query.eq('is_resolved', isResolved === 'true');
    }

    if (rating !== undefined) {
      const parsedRating = parseInt(rating);
      if (!isNaN(parsedRating)) {
        query = query.eq('rating', parsedRating);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Erro ao buscar feedbacks do banco:', error);
      return res.status(500).json({ error: 'Erro ao carregar feedbacks' });
    }

    // Calcular estatísticas globais rápidas para exibir nos cards superiores
    let stats = null;
    if (offset === 0) {
      const { data: statsData, error: statsError } = await supabase
        .from('feedbacks')
        .select('rating, is_resolved');

      if (!statsError && statsData) {
        const totalCount = statsData.length;
        const pendingCount = statsData.filter(f => !f.is_resolved).length;
        const sum = statsData.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        stats = {
          avgRating: totalCount > 0 ? parseFloat((sum / totalCount).toFixed(1)) : 0,
          pendingCount,
          totalCount
        };
      }
    }

    return res.status(200).json({
      data: data || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit),
      stats
    });
  } catch (err) {
    logger.error('Erro inesperado na listagem de feedbacks:', err);
    return res.status(500).json({
      error: 'Erro interno no servidor',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

/**
 * handleResolveFeedback: POST /api/feedbacks/:id/resolve
 * Atualiza o estado is_resolved de um feedback
 */
export async function handleResolveFeedback(req, res) {
  try {
    const { id } = req.query;
    const { is_resolved } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'ID do feedback ausente' });
    }

    // Validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Formato de ID inválido' });
    }

    if (is_resolved === undefined) {
      return res.status(400).json({ error: 'Estado is_resolved não informado' });
    }

    const { data, error } = await supabase
      .from('feedbacks')
      .update({
        is_resolved: !!is_resolved,
        updated_at: getServerTimestamp()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error(`Erro ao atualizar resolução do feedback ${id}:`, error);
      return res.status(500).json({ error: 'Erro ao salvar alteração do feedback' });
    }

    logger.info(`Feedback ${id} atualizado: is_resolved = ${!!is_resolved}`);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    logger.error('Erro inesperado na atualização do feedback:', err);
    return res.status(500).json({
      error: 'Erro interno no servidor',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}
