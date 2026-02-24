/**
 * Endpoint para persistir reviews do Gemini no Supabase
 *
 * Recebe dados de review via POST (ou baixa do Vercel Blob se blob_url fornecida),
 * valida autenticação JWT, calcula hash SHA-256 dos issues e persiste com
 * deduplicação por hash na tabela gemini_reviews.
 *
 * @module api/gemini-reviews/persist
 * @version 1.1.0
 */

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import {
  checkRateLimit,
  getRateLimitHeaders,
  getClientIP,
  rateLimitResponse,
  internalErrorResponse,
  fetchWithRetry,
} from './shared/security.js'
import {
  logRequest,
  logAuth,
  logSupabase,
  logBlobDownload,
  logResult,
  logError,
  logInfo,
} from './shared/logger.js'

const ENDPOINT = 'persist'

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VERCEL_GITHUB_ACTIONS_SECRET = process.env.VERCEL_GITHUB_ACTIONS_SECRET

/**
 * UUID do usuário sistema para reviews do Gemini.
 * Este UUID representa o agente automatizado do Gemini Code Assist.
 * Nota: Este usuário deve existir em auth.users ou a constraint de FK falhará.
 * Alternativa: tornar user_id nullable via migração se necessário.
 */
const GEMINI_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

// ============================================================================
// SCHEMAS ZOD
// ============================================================================

/**
 * Schema para um issue individual do review
 */
const issueSchema = z.object({
  file_path: z.string().optional(),
  file: z.string().optional(),
  line_start: z.number().int().optional(),
  line: z.number().int().optional(),
  line_end: z.number().int().optional(),
  title: z.string().optional(),
  issue: z.string().optional(),
  description: z.string().optional(),
  suggestion: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  category: z.string().optional(),
})

/**
 * Schema para o body da requisição
 */
const persistRequestSchema = z.object({
  pr_number: z.number().int().positive('Número do PR deve ser positivo'),
  commit_sha: z.string().min(1, 'Commit SHA é obrigatório'),
  issues: z.array(issueSchema),
  blob_url: z.string().url().optional(),
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
// FUNÇÕES DE HASH E DEDUPLICAÇÃO
// ============================================================================

/**
 * Calcula hash SHA-256 para uma issue
 * @param {Object} issue - Dados da issue
 * @returns {string} Hash SHA-256 (64 caracteres hexadecimais)
 */
function calculateIssueHash(issue) {
  const dataToHash = {
    file_path: issue.file_path || issue.file,
    line_start: issue.line_start || issue.line,
    line_end: issue.line_end || issue.line,
    title: issue.title || issue.issue?.substring(0, 100) || 'Untitled',
    description: issue.description || issue.issue || '',
    suggestion: issue.suggestion?.trim() || null,
  }
  const content = JSON.stringify(dataToHash, Object.keys(dataToHash).sort())

  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Verifica se uma issue já existe no banco
 * @param {Object} supabase - Cliente Supabase
 * @param {string} issueHash - Hash SHA-256
 * @returns {Promise<Object|null>} Registro existente ou null
 */
async function checkExistingHash(supabase, issueHash) {
  logSupabase(ENDPOINT, 'select', 'gemini_reviews', {
    operation: 'checkExistingHash',
    hashPrefix: issueHash.substring(0, 16),
  })

  const { data, error } = await supabase
    .from('gemini_reviews')
    .select('id, status, github_issue_number, created_at, updated_at')
    .eq('issue_hash', issueHash)
    .maybeSingle()

  if (error) {
    logError(ENDPOINT, 'Error checking existing hash', error, {
      hashPrefix: issueHash.substring(0, 16),
    })
    throw new Error(`Erro ao verificar hash: ${error.message}`)
  }

  logInfo(ENDPOINT, 'Hash check result', {
    hashPrefix: issueHash.substring(0, 16),
    exists: !!data,
    status: data?.status,
  })

  return data
}

// ============================================================================
// FUNÇÕES DE MAPEAMENTO
// ============================================================================

/**
 * Mapeia prioridade do Gemini para formato do banco
 * @param {string} priority - Prioridade do Gemini
 * @returns {string} Prioridade mapeada
 */
function mapPriority(priority) {
  const map = {
    CRITICAL: 'critica',
    HIGH: 'alta',
    MEDIUM: 'media',
    LOW: 'baixa',
    critical: 'critica',
    high: 'alta',
    medium: 'media',
    low: 'baixa',
  }
  return map[priority] || 'media'
}

/**
 * Mapeia categoria do Gemini para formato do banco
 * @param {string} category - Categoria do Gemini
 * @returns {string} Categoria mapeada
 */
function mapCategory(category) {
  const map = {
    style: 'estilo',
    bug: 'bug',
    security: 'seguranca',
    performance: 'performance',
    maintainability: 'manutenibilidade',
    refactoring: 'manutenibilidade',
    'best-practice': 'manutenibilidade',
  }
  // Default para 'manutenibilidade' pois 'geral' não é válido no CHECK constraint
  return map[category?.toLowerCase()] || 'manutenibilidade'
}

// ============================================================================
// FUNÇÕES DE PERSISTÊNCIA
// ============================================================================

/**
 * Decide ação para issue existente
 * @param {Object} supabase - Cliente Supabase
 * @param {Object} existing - Registro existente
 * @param {Object} newIssue - Nova issue detectada
 * @param {number} prNumber - Número do PR
 * @param {string} commitSha - SHA do commit
 * @returns {Promise<string>} Ação: 'skipped', 'updated', 'reactivated'
 */
async function handleExistingIssue(supabase, existing, newIssue, prNumber, commitSha) {
  const { id, status } = existing

  logInfo(ENDPOINT, 'handleExistingIssue', {
    id,
    currentStatus: status,
    prNumber,
    commitSha: commitSha.substring(0, 8),
  })

  // Estados finais - ignorar
  const finalStatuses = ['wontfix', 'duplicate']
  if (finalStatuses.includes(status)) {
    logInfo(ENDPOINT, 'Issue in final status, skipping', { id, status })
    return 'skipped'
  }

  // Resolvida - reativar (re-introdução)
  if (status === 'resolved') {
    logSupabase(ENDPOINT, 'update', 'gemini_reviews', {
      operation: 'reactivateResolved',
      id,
      fromStatus: 'resolved',
      toStatus: 'detected',
    })
    await supabase
      .from('gemini_reviews')
      .update({
        status: 'detected',
        pr_number: prNumber,
        commit_sha: commitSha,
        updated_at: new Date().toISOString(),
        resolution_type: null,
        resolved_by: null,
        resolved_at: null,
      })
      .eq('id', id)
    return 'reactivated'
  }

  // Parcial - reativar para reported
  if (status === 'partial') {
    logSupabase(ENDPOINT, 'update', 'gemini_reviews', {
      operation: 'reactivatePartial',
      id,
      fromStatus: 'partial',
      toStatus: 'reported',
    })
    await supabase
      .from('gemini_reviews')
      .update({
        status: 'reported',
        pr_number: prNumber,
        commit_sha: commitSha,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    return 'reactivated'
  }

  // Detected/reported/assigned - atualizar referências
  logSupabase(ENDPOINT, 'update', 'gemini_reviews', {
    operation: 'updateReferences',
    id,
    status,
  })
  await supabase
    .from('gemini_reviews')
    .update({
      pr_number: prNumber,
      commit_sha: commitSha,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return 'updated'
}

/**
 * Cria nova issue no Supabase
 * @param {Object} supabase - Cliente Supabase
 * @param {Object} issue - Dados da issue
 * @param {string} issueHash - Hash SHA-256
 * @param {number} prNumber - Número do PR
 * @param {string} commitSha - SHA do commit
 * @returns {Promise<Object>} Issue criada
 */
async function createNewIssue(supabase, issue, issueHash, prNumber, commitSha) {
  const insertData = {
    user_id: GEMINI_SYSTEM_USER_ID,
    pr_number: prNumber,
    commit_sha: commitSha,
    file_path: issue.file_path || issue.file,
    line_start: issue.line_start || issue.line || null,
    line_end: issue.line_end || issue.line || null,
    issue_hash: issueHash,
    status: 'detected',
    priority: mapPriority(issue.priority),
    category: mapCategory(issue.category),
    title: issue.title || issue.issue?.substring(0, 200) || 'Sem título',
    description: issue.description || issue.issue || '',
    suggestion: issue.suggestion || null,
  }

  logSupabase(ENDPOINT, 'insert', 'gemini_reviews', {
    operation: 'createNewIssue',
    hashPrefix: issueHash.substring(0, 16),
    filePath: insertData.file_path,
    priority: insertData.priority,
    category: insertData.category,
  })

  const { data, error } = await supabase.from('gemini_reviews').insert(insertData).select().single()

  if (error) {
    logError(ENDPOINT, 'Error creating new issue', error, {
      errorCode: error.code,
      errorMessage: error.message,
      hashPrefix: issueHash.substring(0, 16),
    })
    // Tratar violação de UNIQUE constraint
    if (error.code === '23505') {
      throw new Error(`Hash collision detectado`)
    }
    throw new Error('Falha ao criar registro')
  }

  logInfo(ENDPOINT, 'Issue created successfully', {
    id: data.id,
    hashPrefix: issueHash.substring(0, 16),
  })

  return data
}

/**
 * Persiste reviews com deduplicação por hash
 * @param {Object} supabase - Cliente Supabase
 * @param {Object} reviewData - Dados do review
 * @returns {Promise<Object>} Resultado da persistência
 */
async function persistReviews(supabase, reviewData) {
  const { pr_number, commit_sha, issues } = reviewData

  logInfo(ENDPOINT, 'persistReviews started', {
    pr_number,
    commit_sha: commit_sha.substring(0, 8),
    issuesCount: issues.length,
  })

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    reactivated: 0,
    errors: [],
    createdIssues: [],
  }

  for (const [index, issue] of issues.entries()) {
    try {
      const issueHash = calculateIssueHash(issue)
      logInfo(ENDPOINT, `Processing issue ${index + 1}/${issues.length}`, {
        hashPrefix: issueHash.substring(0, 16),
        title: issue.title || issue.issue?.substring(0, 50) || 'Untitled',
      })

      const existing = await checkExistingHash(supabase, issueHash)

      if (existing) {
        const action = await handleExistingIssue(supabase, existing, issue, pr_number, commit_sha)
        logInfo(ENDPOINT, 'Existing issue handled', {
          hashPrefix: issueHash.substring(0, 16),
          action,
          existingStatus: existing.status,
        })

        switch (action) {
          case 'skipped':
            results.skipped++
            break
          case 'updated':
            results.updated++
            break
          case 'reactivated':
            results.reactivated++
            break
        }
        continue
      }

      // Criar nova issue
      const newIssue = await createNewIssue(supabase, issue, issueHash, pr_number, commit_sha)
      results.created++
      results.createdIssues.push({
        id: newIssue.id,
        hash: issueHash,
        status: newIssue.status,
      })
    } catch (error) {
      logError(ENDPOINT, 'Error processing issue', error, {
        issueIndex: index,
        issueTitle: issue.title || 'Sem título',
      })
      results.errors.push({
        issue: issue.title || 'Sem título',
        error: 'Falha ao processar',
      })
    }
  }

  logInfo(ENDPOINT, 'persistReviews completed', {
    created: results.created,
    updated: results.updated,
    skipped: results.skipped,
    reactivated: results.reactivated,
    errorsCount: results.errors.length,
  })

  return results
}

/**
 * Baixa dados do review do Vercel Blob usando fetch com retry
 * @param {string} blobUrl - URL do blob
 * @returns {Promise<Object>} Dados do review
 */
async function downloadFromBlob(blobUrl) {
  logBlobDownload(ENDPOINT, blobUrl, { status: 'starting' })

  const response = await fetchWithRetry(blobUrl, {}, 3)

  if (!response.ok) {
    logError(ENDPOINT, 'Blob download failed', new Error(`HTTP ${response.status}`), {
      status: response.status,
      statusText: response.statusText,
    })
    throw new Error(`Falha ao baixar do Blob: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  logBlobDownload(ENDPOINT, blobUrl, {
    status: 'success',
    dataSize: JSON.stringify(data).length,
    issuesCount: data?.issues?.length || 0,
  })

  return data
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
    let reviewData

    // Se blob_url fornecida, baixar dados do Blob
    if (req.body.blob_url) {
      logInfo(ENDPOINT, 'Blob URL provided, downloading...', {
        blobUrl: req.body.blob_url.split('?')[0],
      })
      try {
        reviewData = await downloadFromBlob(req.body.blob_url)
      } catch (error) {
        logError(ENDPOINT, 'Failed to download from Blob', error, {
          blobUrl: req.body.blob_url.split('?')[0],
        })
        return res.status(400).json({
          success: false,
          error: 'Erro ao baixar dados do Blob',
        })
      }
    } else {
      logInfo(ENDPOINT, 'Using body directly (no blob URL)')
      reviewData = req.body
    }

    // Validar body da requisição
    logInfo(ENDPOINT, 'Validating request data', {
      pr_number: reviewData?.pr_number,
      commit_sha: reviewData?.commit_sha?.substring(0, 8),
      issuesCount: reviewData?.issues?.length || 0,
    })

    const validation = persistRequestSchema.safeParse(reviewData)

    if (!validation.success) {
      logInfo(ENDPOINT, 'Validation failed', {
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

    const validatedData = validation.data
    logInfo(ENDPOINT, 'Validation successful', {
      pr_number: validatedData.pr_number,
      commit_sha: validatedData.commit_sha.substring(0, 8),
      issuesCount: validatedData.issues.length,
    })

    // Criar cliente Supabase
    logSupabase(ENDPOINT, 'connect', 'gemini_reviews', {
      operation: 'createClient',
    })
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Persistir reviews
    logInfo(ENDPOINT, 'Starting persistReviews', {
      issuesCount: validatedData.issues.length,
    })
    const results = await persistReviews(supabase, validatedData)

    // Retornar resultado
    const responseHeaders = getRateLimitHeaders(clientIP)

    logResult(ENDPOINT, 'persistReviews', {
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      reactivated: results.reactivated,
      errorsCount: results.errors.length,
    })

    return res.status(200).set(responseHeaders).json({
      success: true,
      data: results,
    })
  } catch (error) {
    logError(ENDPOINT, 'Unhandled error in handler', error, {
      errorMessage: error.message,
      errorStack: error.stack,
    })
    return internalErrorResponse(res, error, 'persist')
  }
}
