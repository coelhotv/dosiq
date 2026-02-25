/**
 * Endpoint para criar GitHub Issues a partir de reviews do Gemini
 *
 * Recebe dados do review, busca issues pendentes no Supabase
 * (status='detected', priority='media'), cria issues no GitHub via API
 * e atualiza o Supabase com github_issue_number.
 *
 * @module api/gemini-reviews/create-issues
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
  fetchWithRetry,
} from './shared/security.js'
import {
  logRequest,
  logAuth,
  logSupabase,
  logGitHub,
  logBlobDownload,
  logResult,
  logError,
  logInfo,
} from './shared/logger.js'

const ENDPOINT = 'create-issues'

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

// Fallback para VITE_SUPABASE_URL caso SUPABASE_URL não esteja definida
// (Vercel pode ter apenas VITE_SUPABASE_URL configurada)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VERCEL_GITHUB_ACTIONS_SECRET = process.env.VERCEL_GITHUB_ACTIONS_SECRET
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
// Token para acessar blobs privados do Vercel Blob Storage
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_TOKEN

// Labels para issues de refactoring
const REFACTOR_LABELS = {
  GEMINI_REFACTOR: '🤖 gemini-refactor',
  REFACTORING: 'refactoring',
  TECH_DEBT: 'tech-debt',
}

// ============================================================================
// SCHEMAS ZOD
// ============================================================================

/**
 * Schema para um issue individual
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
  suggestion: z.string().nullable().optional(), // Allow both null and undefined
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  category: z.string().optional(),
  auto_fixable: z.boolean().optional(),
})

/**
 * Schema para o body da requisição
 * Nota: github_token removido - usa GITHUB_TOKEN do ambiente apenas
 */
const createIssuesRequestSchema = z.object({
  pr_number: z.number().int().positive('Número do PR deve ser positivo'),
  commit_sha: z.string().min(1, 'Commit SHA é obrigatório'),
  issues: z.array(issueSchema).min(0),
  blob_url: z.string().url().optional(),
  owner: z.string().min(1, 'Owner é obrigatório'),
  repo: z.string().min(1, 'Repo é obrigatório'),
})

/**
 * Schema para registro do Supabase
 * Nota: 'geral' removido do category enum pois não é válido no CHECK constraint
 */
const pendingIssueSchema = z.object({
  id: z.string().uuid(),
  pr_number: z.number().int().positive(),
  file_path: z.string(),
  line_start: z.number().int().nullable().optional(),
  line_end: z.number().int().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  suggestion: z.string().nullable().optional(),
  priority: z.enum(['critica', 'alta', 'media', 'baixa']),
  category: z.enum(['estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade']),
  issue_hash: z.string().length(64),
  status: z.string(),
  github_issue_number: z.number().int().positive().nullable().optional(),
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
// FUNÇÕES DO GITHUB API
// ============================================================================

/**
 * Cria uma issue no GitHub usando fetch com retry
 * @param {Object} issue - Dados da issue do Supabase
 * @param {number} prNumber - Número do PR
 * @param {string} owner - Owner do repositório
 * @param {string} repo - Nome do repositório
 * @param {string} token - Token GitHub
 * @returns {Promise<Object>} Issue criada
 */
async function createGitHubIssue(issue, prNumber, owner, repo, token) {
  const body = buildIssueBody(issue, prNumber)

  // Map priority to prefix (P2: Dynamic prefix based on priority)
  // Note: issue.priority comes from Supabase in Portuguese
  const priorityPrefix = {
    'critica': 'CRITICAL',
    'alta': 'High',
    'media': 'Medium',
    'baixa': 'Low'
  }
  const prefix = priorityPrefix[issue.priority] || 'Medium'

  logGitHub(ENDPOINT, 'createIssue', {
    owner,
    repo,
    issueTitle: issue.title?.substring(0, 50),
    prNumber,
    priority: issue.priority,
    prefix
  })

  const response = await fetchWithRetry(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[${prefix}] ${issue.title}`,
        body: body,
        labels: [
          REFACTOR_LABELS.GEMINI_REFACTOR,
          REFACTOR_LABELS.REFACTORING,
          `priority:${issue.priority}`,
        ],
      }),
    },
    3 // maxRetries
  )

  if (!response.ok) {
    const error = await response.json()
    logError(ENDPOINT, 'GitHub API error', new Error(`HTTP ${response.status}`), {
      status: response.status,
      errorMessage: error.message,
      errorDetails: error,
    })
    throw new Error(`GitHub API error: ${response.status} - ${error.message || 'Unknown error'}`)
  }

  const result = await response.json()
  logGitHub(ENDPOINT, 'issueCreated', {
    issueNumber: result.number,
    issueUrl: result.html_url,
  })

  return result
}

/**
 * Comenta no PR linkando a issue usando fetch com retry
 * @param {number} prNumber - Número do PR
 * @param {number} issueNumber - Número da issue
 * @param {string} owner - Owner do repositório
 * @param {string} repo - Nome do repositório
 * @param {string} token - Token GitHub
 */
async function commentOnPR(prNumber, issueNumber, owner, repo, token) {
  logGitHub(ENDPOINT, 'commentOnPR', {
    prNumber,
    issueNumber,
    owner,
    repo,
  })

  try {
    const response = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: `🤖 **Gemini Code Assist** criou issue #${issueNumber} para tracking desta sugestão de refactoring.`,
        }),
      },
      3 // maxRetries
    )

    if (!response.ok) {
      logError(ENDPOINT, 'Failed to comment on PR', new Error(`HTTP ${response.status}`), {
        prNumber,
        issueNumber,
        status: response.status,
      })
    } else {
      logGitHub(ENDPOINT, 'commentCreated', { prNumber, issueNumber })
    }
  } catch (error) {
    // Não falhar se o comentário não puder ser criado
    logError(ENDPOINT, 'Exception commenting on PR', error, { prNumber, issueNumber })
  }
}

/**
 * Constrói o corpo da issue no GitHub
 * @param {Object} issue - Dados da issue
 * @param {number} prNumber - Número do PR
 * @returns {string} Corpo formatado em Markdown
 */
function buildIssueBody(issue, prNumber) {
  const lines = [
    '## 📋 Sugestão de Refactoring',
    '',
    `**Detectado em:** PR #${prNumber}`,
    `**Arquivo:** \`${issue.file_path}\``,
    `**Linhas:** ${issue.line_start || 'N/A'}-${issue.line_end || 'N/A'}`,
    `**Categoria:** ${issue.category}`,
    `**Prioridade:** ${issue.priority}`,
    `**Hash:** \`${issue.issue_hash?.substring(0, 16)}...\``,
    '',
    '### Descrição',
    issue.description || 'Sem descrição detalhada',
    '',
    '### Sugestão',
    '```javascript',
    issue.suggestion || 'Nenhuma sugestão específica',
    '```',
    '',
    '---',
    '*Esta issue foi criada automaticamente pelo Gemini Code Assist. O hash único garante que não haverá duplicatas.*',
    '*Para reabrir após correção parcial, use o comando "/gemini reopen".*',
  ]

  return lines.join('\n')
}

// ============================================================================
// FUNÇÕES DO SUPABASE
// ============================================================================

/**
 * Busca issues pendentes no Supabase
 * Critérios: status='detected', priority='media', sem github_issue_number
 * @param {Object} supabase - Cliente Supabase
 * @param {number} prNumber - Número do PR
 * @returns {Promise<Array<Object>>} Lista de issues pendentes
 */
async function fetchPendingIssues(supabase, prNumber) {
  logSupabase(ENDPOINT, 'select', 'gemini_reviews', {
    operation: 'fetchPendingIssues',
    prNumber,
    filters: { status: 'detected', priority: ['media', 'alta', 'critica'], github_issue_number: null },
  })

  const { data, error } = await supabase
    .from('gemini_reviews')
    .select('*')
    .eq('pr_number', prNumber)
    .eq('status', 'detected')
    .in('priority', ['media', 'alta', 'critica'])
    .is('github_issue_number', null)
    .limit(10)

  if (error) {
    logError(ENDPOINT, 'Error fetching pending issues', error, {
      prNumber,
      errorMessage: error.message,
    })
    throw new Error(`Falha ao buscar issues pendentes: ${error.message}`)
  }

  logInfo(ENDPOINT, 'Pending issues fetched', {
    prNumber,
    count: data?.length || 0,
  })

  return data || []
}

/**
 * Atualiza o status da review no Supabase após criar issue
 * @param {Object} supabase - Cliente Supabase
 * @param {string} id - UUID da review
 * @param {number} issueNumber - Número da issue no GitHub
 */
async function updateReviewStatus(supabase, id, issueNumber) {
  logSupabase(ENDPOINT, 'update', 'gemini_reviews', {
    operation: 'updateReviewStatus',
    id,
    issueNumber,
    newStatus: 'reported',
  })

  const { error } = await supabase
    .from('gemini_reviews')
    .update({
      status: 'reported',
      github_issue_number: issueNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    logError(ENDPOINT, 'Error updating review status', error, {
      id,
      issueNumber,
      errorMessage: error.message,
    })
    throw new Error(`Falha ao atualizar review ${id}: ${error.message}`)
  }

  logInfo(ENDPOINT, 'Review status updated', { id, issueNumber, status: 'reported' })
}

/**
 * Baixa dados do review do Vercel Blob usando fetch com retry
 * @param {string} blobUrl - URL do blob
 * @returns {Promise<Object>} Dados do review
 */
async function downloadFromBlob(blobUrl) {
  logBlobDownload(ENDPOINT, blobUrl, { status: 'starting' })

  // Para blobs privados, precisamos do token de autenticação
  const headers = {}
  if (BLOB_READ_WRITE_TOKEN) {
    headers['Authorization'] = `Bearer ${BLOB_READ_WRITE_TOKEN}`
    logInfo(ENDPOINT, 'Using BLOB_READ_WRITE_TOKEN for authentication')
  } else {
    logInfo(ENDPOINT, 'No BLOB_READ_WRITE_TOKEN found, attempting public access')
  }

  const response = await fetchWithRetry(blobUrl, { headers }, 3)

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
  })

  return data
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

/**
 * Cria GitHub Issues para reviews MEDIUM
 * @param {Object} supabase - Cliente Supabase
 * @param {Object} reviewData - Dados do review
 * @param {string} githubToken - Token GitHub
 * @returns {Promise<Object>} Resultado da criação
 */
async function createIssuesFromReview(supabase, reviewData, githubToken) {
  const { pr_number, owner, repo } = reviewData

  logInfo(ENDPOINT, 'createIssuesFromReview started', {
    pr_number,
    owner,
    repo,
  })

  const results = {
    created: 0,
    issues: [],
    errors: [],
  }

  // Buscar issues pendentes
  const pendingIssues = await fetchPendingIssues(supabase, pr_number)

  if (pendingIssues.length === 0) {
    logInfo(ENDPOINT, 'No pending issues found', { pr_number })
    return results
  }

  logInfo(ENDPOINT, 'Processing pending issues', {
    pr_number,
    count: pendingIssues.length,
  })

  // Criar issues no GitHub
  for (const [index, issue] of pendingIssues.entries()) {
    try {
      logInfo(ENDPOINT, `Processing issue ${index + 1}/${pendingIssues.length}`, {
        reviewId: issue.id,
        title: issue.title?.substring(0, 50),
      })

      // Validar issue do Supabase
      const issueValidation = pendingIssueSchema.safeParse(issue)
      if (!issueValidation.success) {
        logError(ENDPOINT, 'Issue validation failed', new Error('Validation error'), {
          reviewId: issue.id,
          errors: issueValidation.error.issues,
        })
        results.errors.push({
          review_id: issue.id,
          error: 'Dados inválidos',
        })
        continue
      }

      // Criar issue no GitHub
      const githubIssue = await createGitHubIssue(
        issue,
        pr_number,
        owner,
        repo,
        githubToken
      )

      // Atualizar Supabase com referência
      await updateReviewStatus(supabase, issue.id, githubIssue.number)

      // Comentar no PR
      await commentOnPR(pr_number, githubIssue.number, owner, repo, githubToken)

      results.created++
      results.issues.push({
        review_id: issue.id,
        github_issue_number: githubIssue.number,
        title: githubIssue.title,
        url: githubIssue.html_url,
      })

      logInfo(ENDPOINT, 'Issue created successfully', {
        reviewId: issue.id,
        issueNumber: githubIssue.number,
      })
    } catch (error) {
      logError(ENDPOINT, 'Failed to create issue', error, {
        reviewId: issue.id,
        title: issue.title,
      })
      results.errors.push({
        review_id: issue.id,
        title: issue.title,
        error: 'Falha ao criar issue',
      })
    }
  }

  logResult(ENDPOINT, 'createIssuesFromReview', {
    created: results.created,
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
    let requestData

    // Se blob_url fornecida, baixar dados do Blob
    if (req.body.blob_url) {
      logInfo(ENDPOINT, 'Blob URL provided, downloading...', {
        blobUrl: req.body.blob_url.split('?')[0],
      })
      try {
        const blobData = await downloadFromBlob(req.body.blob_url)
        requestData = { ...blobData, ...req.body }
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
      requestData = req.body
    }

    // Validar body da requisição
    logInfo(ENDPOINT, 'Validating request data', {
      pr_number: requestData?.pr_number,
      owner: requestData?.owner,
      repo: requestData?.repo,
      commit_sha: requestData?.commit_sha?.substring(0, 8),
      issuesCount: requestData?.issues?.length || 0,
    })

    const validation = createIssuesRequestSchema.safeParse(requestData)

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
      owner: validatedData.owner,
      repo: validatedData.repo,
    })

    // Usar GITHUB_TOKEN do ambiente apenas (não aceita do body por segurança)
    const githubToken = GITHUB_TOKEN

    if (!githubToken) {
      logError(ENDPOINT, 'GitHub token not configured', new Error('GITHUB_TOKEN not set'))
      return res.status(500).json({
        success: false,
        error: 'Token GitHub não configurado.',
      })
    }

    // Criar cliente Supabase
    logSupabase(ENDPOINT, 'connect', 'gemini_reviews', { operation: 'createClient' })
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Criar issues
    const results = await createIssuesFromReview(supabase, validatedData, githubToken)

    // Retornar resultado
    const hasErrors = results.errors.length > 0
    const allFailed = results.created === 0 && hasErrors

    const responseHeaders = getRateLimitHeaders(clientIP)

    logResult(ENDPOINT, 'handler', {
      created: results.created,
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
        data: results,
        ...(hasErrors && { partial: !allFailed }),
      })
  } catch (error) {
    logError(ENDPOINT, 'Unhandled error in handler', error, {
      errorMessage: error.message,
      errorStack: error.stack,
    })
    return internalErrorResponse(res, error, 'create-issues')
  }
}
