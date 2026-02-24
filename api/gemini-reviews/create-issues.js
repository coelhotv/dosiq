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

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VERCEL_GITHUB_ACTIONS_SECRET = process.env.VERCEL_GITHUB_ACTIONS_SECRET
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

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
  suggestion: z.string().optional(),
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
        title: `[Refactor] ${issue.title}`,
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
    throw new Error(`GitHub API error: ${response.status} - ${error.message || 'Unknown error'}`)
  }

  return await response.json()
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
      console.warn(`Não foi possível comentar no PR: ${response.status}`)
    }
  } catch (error) {
    // Não falhar se o comentário não puder ser criado
    console.warn(`Não foi possível comentar no PR: ${error.message}`)
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
  const { data, error } = await supabase
    .from('gemini_reviews')
    .select('*')
    .eq('pr_number', prNumber)
    .eq('status', 'detected')
    .eq('priority', 'media')
    .is('github_issue_number', null)
    .limit(10)

  if (error) {
    throw new Error(`Falha ao buscar issues pendentes: ${error.message}`)
  }

  return data || []
}

/**
 * Atualiza o status da review no Supabase após criar issue
 * @param {Object} supabase - Cliente Supabase
 * @param {string} id - UUID da review
 * @param {number} issueNumber - Número da issue no GitHub
 */
async function updateReviewStatus(supabase, id, issueNumber) {
  const { error } = await supabase
    .from('gemini_reviews')
    .update({
      status: 'reported',
      github_issue_number: issueNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Falha ao atualizar review ${id}: ${error.message}`)
  }
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

  const results = {
    created: 0,
    issues: [],
    errors: [],
  }

  // Buscar issues pendentes
  const pendingIssues = await fetchPendingIssues(supabase, pr_number)

  if (pendingIssues.length === 0) {
    return results
  }

  // Criar issues no GitHub
  for (const issue of pendingIssues) {
    try {
      // Validar issue do Supabase
      const issueValidation = pendingIssueSchema.safeParse(issue)
      if (!issueValidation.success) {
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
    } catch {
      // Erro não exposto por segurança
      results.errors.push({
        review_id: issue.id,
        title: issue.title,
        error: 'Falha ao criar issue',
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
    let requestData

    // Se blob_url fornecida, baixar dados do Blob
    if (req.body.blob_url) {
      try {
        const blobData = await downloadFromBlob(req.body.blob_url)
        requestData = { ...blobData, ...req.body }
      } catch {
        // Erro não exposto por segurança
        return res.status(400).json({
          success: false,
          error: 'Erro ao baixar dados do Blob',
        })
      }
    } else {
      requestData = req.body
    }

    // Validar body da requisição
    const validation = createIssuesRequestSchema.safeParse(requestData)

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

    // Usar GITHUB_TOKEN do ambiente apenas (não aceita do body por segurança)
    const githubToken = GITHUB_TOKEN

    if (!githubToken) {
      return res.status(500).json({
        success: false,
        error: 'Token GitHub não configurado.',
      })
    }

    // Criar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Criar issues
    const results = await createIssuesFromReview(supabase, validatedData, githubToken)

    // Retornar resultado
    const hasErrors = results.errors.length > 0
    const allFailed = results.created === 0 && hasErrors

    const responseHeaders = getRateLimitHeaders(clientIP)

    return res
      .status(hasErrors ? (allFailed ? 500 : 207) : 200)
      .set(responseHeaders)
      .json({
        success: !allFailed,
        data: results,
        ...(hasErrors && { partial: !allFailed }),
      })
  } catch (error) {
    return internalErrorResponse(res, error, 'create-issues')
  }
}
