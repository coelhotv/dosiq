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

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VERCEL_GITHUB_ACTIONS_SECRET = process.env.VERCEL_GITHUB_ACTIONS_SECRET

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
  const { data, error } = await supabase
    .from('gemini_reviews')
    .select('id, status, github_issue_number, created_at, updated_at')
    .eq('issue_hash', issueHash)
    .maybeSingle()

  if (error) {
    throw new Error(`Erro ao verificar hash`)
  }

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
  return map[category?.toLowerCase()] || 'geral'
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

  // Estados finais - ignorar
  const finalStatuses = ['wontfix', 'duplicate']
  if (finalStatuses.includes(status)) {
    return 'skipped'
  }

  // Resolvida - reativar (re-introdução)
  if (status === 'resolved') {
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
    review_data: issue,
  }

  const { data, error } = await supabase.from('gemini_reviews').insert(insertData).select().single()

  if (error) {
    // Tratar violação de UNIQUE constraint
    if (error.code === '23505') {
      throw new Error(`Hash collision detectado`)
    }
    throw new Error('Falha ao criar registro')
  }

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

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    reactivated: 0,
    errors: [],
    createdIssues: [],
  }

  for (const issue of issues) {
    try {
      const issueHash = calculateIssueHash(issue)
      const existing = await checkExistingHash(supabase, issueHash)

      if (existing) {
        const action = await handleExistingIssue(supabase, existing, issue, pr_number, commit_sha)

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
    } catch {
      // Erro não exposto por segurança
      results.errors.push({
        issue: issue.title || 'Sem título',
        error: 'Falha ao processar',
      })
    }
  }

  return results
}

/**
 * Baixa dados do review do Vercel Blob usando fetch com retry
 * @param {string} blobUrl - URL do blob
 * @returns {Promise<Object>} Dados do review
 */
async function downloadFromBlob(blobUrl) {
  const response = await fetchWithRetry(blobUrl, {}, 3)

  if (!response.ok) {
    throw new Error(`Falha ao baixar do Blob: ${response.status} ${response.statusText}`)
  }

  return await response.json()
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
  // Rate limiting
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return rateLimitResponse(res, getRateLimitHeaders(clientIP))
  }

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
    let reviewData

    // Se blob_url fornecida, baixar dados do Blob
    if (req.body.blob_url) {
      try {
        reviewData = await downloadFromBlob(req.body.blob_url)
      } catch {
        // Erro não exposto por segurança
        return res.status(400).json({
          success: false,
          error: 'Erro ao baixar dados do Blob',
        })
      }
    } else {
      reviewData = req.body
    }

    // Validar body da requisição
    const validation = persistRequestSchema.safeParse(reviewData)

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

    const validatedData = validation.data

    // Criar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Persistir reviews
    const results = await persistReviews(supabase, validatedData)

    // Retornar resultado
    const responseHeaders = getRateLimitHeaders(clientIP)

    return res.status(200).set(responseHeaders).json({
      success: true,
      data: results,
    })
  } catch (error) {
    return internalErrorResponse(res, error, 'persist')
  }
}
