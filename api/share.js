/**
 * Endpoint para compartilhamento de relatórios PDF
 *
 * Recebe arquivo PDF em base64, faz upload para Vercel Blob com TTL
 * e retorna URL compartilhável.
 *
 * @module api/share
 * @version 1.0.0
 */

import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const ENDPOINT = 'share'

// Validação de variáveis de ambiente no startup (R-088, AP-S07)
const REQUIRED_ENV_VARS = [
  'BLOB_READ_WRITE_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

// Fallback para variáveis de ambiente (R-083, AP-S03)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_TOKEN
const BLOB_BASE_URL = process.env.BLOB_BASE_URL || 'https://blob.vercel-storage.com'

/**
 * Valida variáveis de ambiente obrigatórias
 * @throws {Error} Se alguma variável estiver faltando
 */
function validateEnvironment() {
  const missing = []

  if (!SUPABASE_URL) missing.push('SUPABASE_URL ou VITE_SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!BLOB_READ_WRITE_TOKEN) missing.push('BLOB_READ_WRITE_TOKEN ou VERCEL_BLOB_TOKEN')

  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias faltando: ${missing.join(', ')}`)
  }
}

// Executar validação no startup
validateEnvironment()

// ============================================================================
// LOGGER ESTRUTURADO (R-087, AP-S06)
// ============================================================================

/**
 * Níveis de log disponíveis
 * @readonly
 */
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
}

/**
 * Log estruturado com timestamp e contexto
 * @param {string} level - Nível do log (debug, info, warn, error)
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais para o log
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    endpoint: ENDPOINT,
    level,
    message,
    ...data,
  }

  const formattedMessage = `[${ENDPOINT}] ${message}`

  if (level === LOG_LEVELS.ERROR) {
    console.error(formattedMessage, JSON.stringify(logEntry))
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(formattedMessage, JSON.stringify(logEntry))
  } else {
    console.log(formattedMessage, JSON.stringify(logEntry))
  }
}

/**
 * Log de informação
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais
 */
function logInfo(message, data = {}) {
  log(LOG_LEVELS.INFO, message, data)
}

/**
 * Log de erro
 * @param {string} message - Mensagem descritiva
 * @param {Error|Object} error - Erro ocorrido
 * @param {Object} additionalData - Dados adicionais de contexto
 */
function logError(message, error, additionalData = {}) {
  const errorDetails = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { error: String(error) }

  log(LOG_LEVELS.ERROR, message, { ...errorDetails, ...additionalData })
}

/**
 * Log de warning
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais
 */
function logWarn(message, data = {}) {
  log(LOG_LEVELS.WARN, message, data)
}

/**
 * Log de debug
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais
 */
// eslint-disable-next-line no-unused-vars
function logDebug(message, data = {}) {
  log(LOG_LEVELS.DEBUG, message, data)
}

/**
 * Log de requisição recebida (sanitizado)
 * @param {Object} req - Requisição HTTP
 */
function logRequest(req) {
  const sanitizedHeaders = { ...req.headers }
  // Remover dados sensíveis
  if (sanitizedHeaders.authorization) {
    sanitizedHeaders.authorization = '[REDACTED]'
  }
  if (sanitizedHeaders.cookie) {
    sanitizedHeaders.cookie = '[REDACTED]'
  }

  logInfo('Request received', {
    method: req.method,
    path: req.url,
    contentType: req.headers['content-type'],
    hasBody: !!req.body,
  })
}

// ============================================================================
// SCHEMAS ZOD (R-082)
// ============================================================================

/**
 * Schema de validação para o body da requisição
 * - blob: base64 do PDF (máximo 5MB = ~7MB em base64)
 * - filename: nome do arquivo
 * - expiresInHours: tempo de expiração em horas (default: 72, max: 168)
 */
const shareRequestSchema = z.object({
  blob: z.string()
    .min(1, 'Base64 do arquivo é obrigatório')
    .refine(
      (val) => {
        // Verificar tamanho aproximado em bytes (base64 ≈ 4/3 do tamanho original)
        const estimatedSize = (val.length * 3) / 4
        return estimatedSize <= 5 * 1024 * 1024 // 5MB máximo
      },
      { message: 'Arquivo muito grande. Máximo de 5MB.' }
    ),
  filename: z.string()
    .min(1, 'Nome do arquivo é obrigatório')
    .max(255, 'Nome do arquivo muito longo')
    .refine(
      (val) => /^[\w\-.\s]+\.pdf$/i.test(val),
      { message: 'Nome do arquivo deve terminar com .pdf' }
    ),
  expiresInHours: z.number()
    .int()
    .min(1, 'Tempo de expiração mínimo é 1 hora')
    .max(168, 'Tempo de expiração máximo é 168 horas (7 dias)')
    .default(72),
})

// ============================================================================
// FUNÇÕES DE AUTENTICAÇÃO (R-042, AP-016)
// ============================================================================

/**
 * Extrai token do header Authorization
 * @param {Object} req - Requisição HTTP
 * @returns {string|null} Token JWT ou null
 */
function extractToken(req) {
  const authHeader = req.headers.authorization || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

/**
 * Verifica autenticação JWT com Supabase
 * @param {string} token - Token JWT
 * @returns {Promise<Object>} Resultado com { success: boolean, userId?: string, error?: string }
 */
async function verifyAuth(token) {
  if (!token) {
    return { success: false, error: 'Token não fornecido' }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      logWarn('JWT validation failed', { error: error?.message })
      return { success: false, error: 'Token inválido ou expirado' }
    }

    logInfo('JWT validation successful', { userId: data.user.id })
    return { success: true, userId: data.user.id }
  } catch (error) {
    logError('Erro ao verificar autenticação', error)
    return { success: false, error: 'Erro interno de autenticação' }
  }
}

// ============================================================================
// FUNÇÕES DE UPLOAD PARA BLOB
// ============================================================================

/**
 * Faz upload do arquivo para Vercel Blob com TTL
 *
 * @param {Buffer} buffer - Buffer do arquivo
 * @param {string} filename - Nome do arquivo
 * @param {number} expiresInHours - Tempo de expiração em horas
 * @param {string} userId - ID do usuário (para namespace do path)
 * @returns {Promise<Object>} Resultado com { url, expiresAt }
 * @throws {Error} Se o upload falhar
 */
async function uploadToBlob(buffer, filename, expiresInHours, userId) {
  logInfo('Iniciando upload para Blob', { filename, size: buffer.length, expiresInHours })

  // Gerar path único baseado no usuário e timestamp
  const timestamp = Date.now()
  const fileHash = createHash('md5').update(buffer).digest('hex').substring(0, 8)
  const safeFilename = filename.replace(/[^\w\-.]/g, '_')
  const path = `reports/${userId}/${timestamp}-${fileHash}-${safeFilename}`

  // Calcular data de expiração
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

  // Preparar upload usando a API do Vercel Blob
  // Ref: https://vercel.com/docs/storage/vercel-blob/using-blob-sdk
  const uploadUrl = `${BLOB_BASE_URL}/${path}`

  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${BLOB_READ_WRITE_TOKEN}`,
        'Content-Type': 'application/pdf',
        'x-access': 'public', // URL pública para compartilhamento
        'x-vercel-cache-max-age': String(expiresInHours * 60 * 60), // TTL em segundos
      },
      body: buffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Upload falhou: ${response.status} ${response.statusText} - ${errorText}`)
    }

    // Extrair URL pública da resposta
    const responseData = await response.json()
    const publicUrl = responseData.url || `${BLOB_BASE_URL}/${path}`

    logInfo('Upload para Blob concluído', {
      url: publicUrl.split('?')[0],
      expiresAt: expiresAt.toISOString(),
    })

    return {
      url: publicUrl,
      expiresAt: expiresAt.toISOString(),
    }
  } catch (error) {
    logError('Falha no upload para Blob', error)
    throw error
  }
}

/**
 * Decodifica base64 para Buffer
 * @param {string} base64 - String em base64
 * @returns {Buffer} Buffer do arquivo
 * @throws {Error} Se a decodificação falhar
 */
function decodeBase64(base64) {
  try {
    // Remover prefixo data:application/pdf;base64, se existir
    const cleanBase64 = base64.replace(/^data:.*?;base64,/, '')
    return Buffer.from(cleanBase64, 'base64')
  } catch {
    throw new Error('Base64 inválido')
  }
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
  logRequest(req)

  // Verificar método HTTP
  if (req.method !== 'POST') {
    logWarn('Método não permitido', { method: req.method })
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST.',
    })
  }

  try {
    // Verificar autenticação (R-042, AP-016)
    const token = extractToken(req)
    const authResult = await verifyAuth(token)

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        error: authResult.error,
      })
    }

    const userId = authResult.userId

    // Validar body da requisição (R-082)
    logInfo('Validando dados da requisição')

    const validation = shareRequestSchema.safeParse(req.body)

    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))

      logWarn('Validação falhou', { errors })
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors,
      })
    }

    const { blob, filename, expiresInHours } = validation.data

    logInfo('Validação bem-sucedida', { filename, expiresInHours, userId })

    // Decodificar base64
    let buffer
    try {
      buffer = decodeBase64(blob)
      logInfo('Base64 decodificado', { size: buffer.length })
    } catch (error) {
      logError('Erro ao decodificar base64', error)
      return res.status(400).json({
        success: false,
        error: 'Base64 inválido',
      })
    }

    // Fazer upload para Vercel Blob (R-084, AP-S04)
    const { url, expiresAt } = await uploadToBlob(buffer, filename, expiresInHours, userId)

    // Retornar sucesso (R-086, AP-S05)
    logInfo('Operação concluída com sucesso', { url: url.split('?')[0] })

    return res.status(200).json({
      success: true,
      data: {
        url,
        expiresAt,
      },
    })
  } catch (error) {
    // Nunca usar process.exit() - sempre retornar resposta (R-041, AP-010)
    logError('Erro não tratado no handler', error)
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    })
  }
}
