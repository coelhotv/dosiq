// api/admin/_handlers/feedbacks.js
// Handlers para gerenciamento de feedbacks no painel administrativo

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { createLogger } from '../../../server/bot/logger.js';
import { getServerTimestamp } from '../../../packages/core/src/utils/dateUtils.js';

const logger = createLogger('FeedbacksAdmin');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente Supabase instanciado com Service Role para bypass de RLS (inicializado com segurança)
const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, { realtime: { transport: ws } })
  : null;

// Auxiliar para decorar dados de feedbacks com informações de usuários (display_name e email).
async function _decorateFeedbacksWithUserInfo(data) {
  if (!data || data.length === 0) return;

  const userIds = [...new Set(data.filter(f => f.user_id).map(f => f.user_id))];
  if (userIds.length === 0) return;

  // Query em paralelo para display_name (user_settings) e email (user_emails)
  const [settingsRes, authRes] = await Promise.all([
    supabase
      .from('user_settings')
      .select('user_id, display_name')
      .in('user_id', userIds),
    supabase
      .from('user_emails')
      .select('id, email')
      .in('id', userIds)
  ]);

  if (settingsRes.error) {
    logger.error('Erro ao buscar display_names de user_settings:', settingsRes.error);
  }
  if (authRes.error) {
    logger.error('Erro ao buscar emails de user_emails:', authRes.error);
  }

  const userMap = {};
  if (settingsRes.data) {
    settingsRes.data.forEach(u => {
      userMap[u.user_id] = { display_name: u.display_name };
    });
  }
  if (authRes.data) {
    authRes.data.forEach(au => {
      if (!userMap[au.id]) {
        userMap[au.id] = {};
      }
      userMap[au.id].email = au.email;
    });
  }

  data.forEach(f => {
    const uInfo = userMap[f.user_id] || {};
    const name = uInfo.display_name?.trim();
    const email = uInfo.email?.trim();

    let display = 'Usuário do Dosiq';
    if (name) {
      display = email ? `${name} (${email})` : name;
    } else if (email) {
      display = email;
    }

    f.user_settings = { display_name: display };
  });
}

// Auxiliar para obter as estatísticas agregadas de feedback.
async function _fetchFeedbackStats() {
  const { data: statsData, error: statsError } = await supabase
    .from('feedback_stats')
    .select('*')
    .single();

  if (statsError) {
    logger.error('Erro ao buscar estatísticas de feedback:', statsError);
    return null;
  }

  if (statsData) {
    return {
      avgRating: parseFloat(statsData.avg_rating) || 0,
      pendingCount: parseInt(statsData.pending_count) || 0,
      totalCount: parseInt(statsData.total_count) || 0
    };
  }
  return null;
}

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

    // Conecta feedbacks ao display_name do usuário em user_settings buscando separadamente
    let query = supabase
      .from('feedbacks')
      .select('*', { count: 'exact' })
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

    await _decorateFeedbacksWithUserInfo(data);

    const stats = await _fetchFeedbackStats();

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
