/**
 * Handler para atualização em batch de reviews do Gemini
 *
 * Permite que agents externos atualizem o status de múltiplas reviews
 * de uma única requisição. Usa autenticação via token webhook.
 *
 * @module api/gemini-reviews/_handlers/batch-update
 * @version 1.0.0
 */

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'crypto'

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

// Fallback para VITE_SUPABASE_URL caso SUPABASE_URL não esteja definida
// (Vercel pode ter apenas VITE_SUPABASE_URL configurada)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const AGENT_WEBHOOK_SECRET = process.env.AGENT_WEBHOOK_SECRET

// ============================================================================
// SCHEMAS ZOD
// ============================================================================

/**
 * Status possíveis das reviews
 * @readonly
 */
const REVIEW_STATUSES = [
  'detected',
  'reported',
  'assigned',
  'resolved',
  'partial',
  'wontfix',
  'duplicate',
  'pendente',
  'em_progresso',
  'corrigido',
  'descartado',
]

/**
 * Tipos de resolução possíveis
 * @readonly
 */
const RESOLUTION_TYPES = ['fixed', 'rejected', 'partial']

/**
 * Schema para item de atualização individual
 */
const batchUpdateItemSchema = z.object({
  review_id: z.string().uuid('ID da review deve ser um UUID válido'),
  status: z.enum(REVIEW_STATUSES, {
    errorMap: () => ({ message: 'Status inválido' }),
  }),
  resolution_type: z.enum(RESOLUTION_TYPES).nullable().optional(),
  commit_sha: z.string().min(1).optional(),
  resolved_by: z.string().uuid().nullable().optional(),
})

/**
 * Schema para o body da requisição
 */
const batchUpdateSchema = z.object({
  updates: z
    .array(batchUpdateItemSchema)
    .min(1, 'Deve haver pelo menos uma atualização')
    .max(100, 'Máximo de 100 atualizações por requisição'),
})

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Verifica se a requisição está autenticada usando timing-safe comparison
 * @param {Object} req - Requisição HTTP
 * @returns {boolean} true se autenticado
 */
function isAuthenticated(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token || !AGENT_WEBHOOK_SECRET) {
    return false
  }

  // Timing-safe comparison para prevenir timing attacks
  try {
    const tokenBuffer = Buffer.from(token)
    const secretBuffer = Buffer.from(AGENT_WEBHOOK_SECRET)

    if (tokenBuffer.length !== secretBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(tokenBuffer, secretBuffer)
  } catch {
    return false
  }
}

/**
 * Atualiza uma única review no Supabase
 * @param {Object} supabase - Cliente Supabase
 * @param {Object} update - Dados da atualização
 * @returns {Promise<Object>} Resultado da atualização
 */
async function updateReview(supabase, update) {
  const { review_id, status, resolution_type, commit_sha, resolved_by } = update

  // Construir objeto de atualização
  const updateData = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (resolution_type !== undefined) {
    updateData.resolution_type = resolution_type
  }

  if (commit_sha !== undefined) {
    updateData.commit_sha = commit_sha
  }

  if (resolved_by !== undefined) {
    updateData.resolved_by = resolved_by
  }

  // Se status é resolved/partial/wontfix, adicionar resolved_at
  if (['resolved', 'partial', 'wontfix', 'corrigido', 'descartado'].includes(status)) {
    updateData.resolved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('gemini_reviews')
    .update(updateData)
    .eq('id', review_id)
    .select('id, status')
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar review ${review_id}: ${error.message}`)
  }

  return data
}

/**
 * Processa atualizações em batch com tratamento de erro individual
 * @param {Object} supabase - Cliente Supabase
 * @param {Array<Object>} updates - Lista de atualizações
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processBatchUpdates(supabase, updates) {
  const results = {
    success: [],
    errors: [],
  }

  for (const update of updates) {
    try {
      const updated = await updateReview(supabase, update)
      results.success.push({
        review_id: update.review_id,
        status: updated.status,
      })
    } catch (error) {
      results.errors.push({
        review_id: update.review_id,
        error: error.message,
      })
    }
  }

  return results
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

/**
 * Handler para requisições HTTP
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
export async function handleBatchUpdate(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST.',
    })
  }

  // Verificar variáveis de ambiente PRIMEIRO (antes da autenticação)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Configuração do servidor incompleta.',
    })
  }

  // Verificar autenticação
  if (!isAuthenticated(req)) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado. Token inválido ou ausente.',
    })
  }

  try {
    // Validar body da requisição
    const validation = batchUpdateSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const { updates } = validation.data

    // Criar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Processar atualizações
    const results = await processBatchUpdates(supabase, updates)

    // Retornar resultado
    const hasErrors = results.errors.length > 0
    const allFailed = results.success.length === 0

    return res.status(hasErrors ? (allFailed ? 500 : 207) : 200).json({
      success: !allFailed,
      updated: results.success.length,
      errors: results.errors,
      ...(hasErrors && { partial: !allFailed }),
    })
  } catch (error) {
    console.error('Erro no batch-update:', error)

    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message,
    })
  }
}
