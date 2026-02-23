/**
 * Endpoint para atualizar status de resolução de reviews do Gemini
 *
 * Recebe atualização de status (resolved, partial, wontfix, duplicate),
 * valida autenticação JWT e atualiza o registro no Supabase.
 *
 * @module api/gemini-reviews/update-status
 * @version 1.0.0
 */

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import jwt from 'jsonwebtoken'

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VERCEL_GITHUB_ACTIONS_SECRET = process.env.VERCEL_GITHUB_ACTIONS_SECRET

// ============================================================================
// CONSTANTES
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
]

/**
 * Tipos de resolução possíveis
 * @readonly
 */
const RESOLUTION_TYPES = ['fixed', 'rejected', 'partial']

// ============================================================================
// SCHEMAS ZOD
// ============================================================================

/**
 * Schema para o body da requisição
 */
const updateStatusSchema = z.object({
  review_id: z.string().uuid('ID da review deve ser um UUID válido'),
  status: z.enum(REVIEW_STATUSES, {
    errorMap: () => ({ message: 'Status inválido' }),
  }),
  resolution_type: z.enum(RESOLUTION_TYPES).nullable().optional(),
  commit_sha: z.string().min(1).optional(),
  resolved_by: z.string().uuid().nullable().optional(),
})

/**
 * Schema para atualização em batch (múltiplas reviews)
 */
const batchUpdateSchema = z.object({
  updates: z
    .array(updateStatusSchema)
    .min(1, 'Deve haver pelo menos uma atualização')
    .max(100, 'Máximo de 100 atualizações por requisição'),
})

// ============================================================================
// FUNÇÕES DE AUTENTICAÇÃO
// ============================================================================

/**
 * Verifica autenticação JWT
 * @param {Object} req - Requisição HTTP
 * @returns {boolean} true se autenticado
 */
function verifyAuth(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token || !VERCEL_GITHUB_ACTIONS_SECRET) {
    return false
  }

  try {
    jwt.verify(token, VERCEL_GITHUB_ACTIONS_SECRET, {
      issuer: 'github-actions',
      audience: 'vercel-api',
    })
    return true
  } catch {
    return false
  }
}

// ============================================================================
// FUNÇÕES DE ATUALIZAÇÃO
// ============================================================================

/**
 * Atualiza o status de uma review no Supabase
 * @param {Object} supabase - Cliente Supabase
 * @param {Object} update - Dados da atualização
 * @returns {Promise<Object>} Resultado da atualização
 */
async function updateReviewStatus(supabase, update) {
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
  if (['resolved', 'partial', 'wontfix'].includes(status)) {
    updateData.resolved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('gemini_reviews')
    .update(updateData)
    .eq('id', review_id)
    .select('id, status, github_issue_number')
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar review ${review_id}: ${error.message}`)
  }

  return data
}

/**
 * Processa atualização de uma única review
 * @param {Object} supabase - Cliente Supabase
 * @param {Object} update - Dados da atualização
 * @returns {Promise<Object>} Resultado da atualização
 */
async function processSingleUpdate(supabase, update) {
  try {
    const updated = await updateReviewStatus(supabase, update)
    return {
      review_id: update.review_id,
      status: updated.status,
      github_issue_number: updated.github_issue_number,
      success: true,
    }
  } catch (error) {
    return {
      review_id: update.review_id,
      success: false,
      error: error.message,
    }
  }
}

/**
 * Processa atualizações em batch
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
    const result = await processSingleUpdate(supabase, update)

    if (result.success) {
      results.success.push({
        review_id: result.review_id,
        status: result.status,
        github_issue_number: result.github_issue_number,
      })
    } else {
      results.errors.push({
        review_id: result.review_id,
        error: result.error,
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
export default async function handler(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST.',
    })
  }

  // Verificar variáveis de ambiente
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Configuração do servidor incompleta.',
    })
  }

  // Verificar autenticação
  if (!verifyAuth(req)) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado. Token inválido ou expirado.',
    })
  }

  try {
    // Detectar se é batch ou single update
    const isBatch = Array.isArray(req.body.updates)

    if (isBatch) {
      // Validação batch
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

      // Processar atualizações em batch
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
    } else {
      // Validação single
      const validation = updateStatusSchema.safeParse(req.body)

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

      const update = validation.data

      // Criar cliente Supabase
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Processar atualização única
      const result = await processSingleUpdate(supabase, update)

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
          review_id: result.review_id,
        })
      }

      return res.status(200).json({
        success: true,
        data: {
          review_id: result.review_id,
          status: result.status,
          github_issue_number: result.github_issue_number,
        },
      })
    }
  } catch (error) {
    console.error('Erro no update-status:', error)

    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message,
    })
  }
}
