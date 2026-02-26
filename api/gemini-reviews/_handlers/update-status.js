/**
 * Handler para atualizar status de resolução de reviews do Gemini
 *
 * Recebe atualização de status (resolved, partial, wontfix, duplicate),
 * valida autenticação JWT e atualiza o registro no Supabase.
 *
 * @module api/gemini-reviews/_handlers/update-status
 * @version 1.1.0
 */

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import {
  checkRateLimit,
  getRateLimitHeaders,
  getClientIP,
  rateLimitResponse,
  internalErrorResponse,
} from '../_shared/security.js'
import {
  logRequest,
  logAuth,
  logSupabase,
  logResult,
  logError,
  logInfo,
} from '../_shared/logger.js'

const ENDPOINT = 'update-status'

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

// Fallback para VITE_SUPABASE_URL caso SUPABASE_URL não esteja definida
// (Vercel pode ter apenas VITE_SUPABASE_URL configurada)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
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
 * @returns {Object} Resultado com success e reason
 */
function verifyAuth(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token) {
    return { success: false, reason: 'No token provided' }
  }

  if (!VERCEL_GITHUB_ACTIONS_SECRET) {
    return { success: false, reason: 'Secret not configured' }
  }

  try {
    jwt.verify(token, VERCEL_GITHUB_ACTIONS_SECRET, {
      issuer: 'github-actions',
      audience: 'vercel-api',
    })
    return { success: true }
  } catch (error) {
    return { success: false, reason: error.message }
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

  logSupabase(ENDPOINT, 'update', 'gemini_reviews', {
    operation: 'updateReviewStatus',
    review_id,
    newStatus: status,
    resolution_type,
  })

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
    logError(ENDPOINT, 'Error updating review status', error, {
      review_id,
      status,
      errorMessage: error.message,
      errorCode: error.code,
    })
    throw new Error('Erro ao atualizar review')
  }

  logInfo(ENDPOINT, 'Review status updated', {
    review_id,
    status: data.status,
    github_issue_number: data.github_issue_number,
  })

  return data
}

/**
 * Processa atualização de uma única review
 * @param {Object} supabase - Cliente Supabase
 * @param {Object} update - Dados da atualização
 * @returns {Promise<Object>} Resultado da atualização
 */
async function processSingleUpdate(supabase, update) {
  logInfo(ENDPOINT, 'Processing single update', {
    review_id: update.review_id,
    status: update.status,
  })

  try {
    const updated = await updateReviewStatus(supabase, update)
    return {
      review_id: update.review_id,
      status: updated.status,
      github_issue_number: updated.github_issue_number,
      success: true,
    }
  } catch (error) {
    logError(ENDPOINT, 'Failed to process single update', error, {
      review_id: update.review_id,
    })
    return {
      review_id: update.review_id,
      success: false,
      error: 'Falha ao atualizar',
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
  logInfo(ENDPOINT, 'Processing batch updates', {
    count: updates.length,
  })

  const results = {
    success: [],
    errors: [],
  }

  for (const [index, update] of updates.entries()) {
    logInfo(ENDPOINT, `Processing update ${index + 1}/${updates.length}`, {
      review_id: update.review_id,
    })

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

  logResult(ENDPOINT, 'batchUpdates', {
    successCount: results.success.length,
    errorsCount: results.errors.length,
  })

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
export async function handleUpdateStatus(req, res) {
  // Log inicial da requisição
  logRequest(ENDPOINT, req)

  // Rate limiting
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    logInfo(ENDPOINT, 'Rate limit exceeded', { clientIP: clientIP.substring(0, 3) + '***' })
    return rateLimitResponse(res, getRateLimitHeaders(clientIP))
  }

  // Verificar método HTTP
  if (req.method !== 'POST') {
    logInfo(ENDPOINT, 'Method not allowed', { method: req.method })
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST.',
    })
  }

  // Verificar variáveis de ambiente
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logError(ENDPOINT, 'Missing environment variables', new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'))
    return res.status(500).json({
      success: false,
      error: 'Configuração do servidor incompleta.',
    })
  }

  // Verificar autenticação
  const authResult = verifyAuth(req)
  logAuth(ENDPOINT, authResult.success, authResult.reason)

  if (!authResult.success) {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado. Token inválido ou expirado.',
    })
  }

  try {
    // Detectar se é batch ou single update
    const isBatch = Array.isArray(req.body.updates)

    logInfo(ENDPOINT, 'Request type detected', {
      isBatch,
      bodyKeys: Object.keys(req.body || {}),
    })

    if (isBatch) {
      logInfo(ENDPOINT, 'Processing batch update', {
        updatesCount: req.body.updates?.length,
      })

      // Validação batch
      const validation = batchUpdateSchema.safeParse(req.body)

      if (!validation.success) {
        logInfo(ENDPOINT, 'Batch validation failed', {
          errors: validation.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        })
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

      logInfo(ENDPOINT, 'Batch validation successful', {
        updatesCount: updates.length,
      })

      // Criar cliente Supabase
      logSupabase(ENDPOINT, 'connect', 'gemini_reviews', { operation: 'createClient' })
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Processar atualizações em batch
      const results = await processBatchUpdates(supabase, updates)

      // Retornar resultado
      const hasErrors = results.errors.length > 0
      const allFailed = results.success.length === 0

      const responseHeaders = getRateLimitHeaders(clientIP)

      logResult(ENDPOINT, 'batchUpdate', {
        successCount: results.success.length,
        errorsCount: results.errors.length,
        allFailed,
      })

      // Set headers individually (Vercel serverless doesn't support .set() chain)
      Object.entries(responseHeaders).forEach(([key, value]) => {
        res.setHeader(key, value)
      })

      return res
        .status(hasErrors ? (allFailed ? 500 : 207) : 200)
        .json({
          success: !allFailed,
          updated: results.success.length,
          errors: results.errors,
          ...(hasErrors && { partial: !allFailed }),
        })
    } else {
      logInfo(ENDPOINT, 'Processing single update', {
        review_id: req.body.review_id,
        status: req.body.status,
      })

      // Validação single
      const validation = updateStatusSchema.safeParse(req.body)

      if (!validation.success) {
        logInfo(ENDPOINT, 'Single validation failed', {
          errors: validation.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        })
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

      logInfo(ENDPOINT, 'Single validation successful', {
        review_id: update.review_id,
        status: update.status,
      })

      // Criar cliente Supabase
      logSupabase(ENDPOINT, 'connect', 'gemini_reviews', { operation: 'createClient' })
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Processar atualização única
      const result = await processSingleUpdate(supabase, update)

      if (!result.success) {
        logError(ENDPOINT, 'Single update failed', new Error(result.error), {
          review_id: result.review_id,
        })
        return res.status(500).json({
          success: false,
          error: 'Falha ao atualizar status',
          review_id: result.review_id,
        })
      }

      const responseHeaders = getRateLimitHeaders(clientIP)

      logResult(ENDPOINT, 'singleUpdate', {
        review_id: result.review_id,
        status: result.status,
      })

      // Set headers individually (Vercel serverless doesn't support .set() chain)
      Object.entries(responseHeaders).forEach(([key, value]) => {
        res.setHeader(key, value)
      })

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
    logError(ENDPOINT, 'Unhandled error in handler', error, {
      errorMessage: error.message,
      errorStack: error.stack,
    })
    return internalErrorResponse(res, error, 'update-status')
  }
}
