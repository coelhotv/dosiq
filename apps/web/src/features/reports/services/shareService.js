/**
 * Service para compartilhamento de relatórios
 *
 * Fornece funções para upload de PDFs para compartilhamento temporário
 * e integração com Web Share API e Clipboard API.
 *
 * @module src/features/reports/services/shareService
 * @version 1.0.0
 */

import { supabase } from '@shared/utils/supabase'
import { getNow } from '@utils/dateUtils'
import { debugLog } from '@shared/utils/logger'

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const API_ENDPOINT = '/api/share'

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

// ============================================================================
// LOGGER ESTRUTURADO (R-087)
// ============================================================================

/**
 * Log estruturado com timestamp e contexto
 * @param {string} level - Nível do log (debug, info, warn, error)
 * @param {string} message - Mensagem descritiva
 * @param {Object} data - Dados adicionais para o log
 */
function log(level, message, data = {}) {
  const timestamp = getNow().toISOString()
  const logEntry = {
    timestamp,
    service: 'shareService',
    level,
    message,
    ...data,
  }

  const formattedMessage = `[shareService] ${message}`

  if (level === LOG_LEVELS.ERROR) {
    console.error(formattedMessage, logEntry)
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(formattedMessage, logEntry)
  } else {
    debugLog('shareService', message, logEntry)
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
  const errorDetails =
    error instanceof Error
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

// ============================================================================
// FUNÇÕES PÚBLICAS
// ============================================================================

/**
 * Obtém o token de acesso JWT do Supabase
 * @returns {Promise<string|null>} Token JWT ou null se não autenticado
 */
async function getAuthToken() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    logError('Erro ao obter token de autenticação', error)
    return null
  }
}

/**
 * Faz upload de um relatório PDF para compartilhamento temporário
 *
 * @param {Blob} blob - Arquivo PDF em formato Blob
 * @param {Object} options - Opções de compartilhamento
 * @param {string} options.filename - Nome do arquivo (deve terminar com .pdf)
 * @param {number} [options.expiresInHours=72] - Tempo de expiração em horas (1-168)
 * @returns {Promise<Object>} Resultado com { url, expiresAt }
 * @throws {Error} Se o upload falhar ou usuário não estiver autenticado
 *
 * @example
 * const pdfBlob = await generatePDF()
 * const { url, expiresAt } = await shareReport(pdfBlob, {
 *   filename: 'relatorio-medicamentos.pdf',
 *   expiresInHours: 48
 * })
 */
export async function shareReport(blob, options) {
  const { filename, expiresInHours = 72 } = options

  logInfo('Iniciando compartilhamento de relatório', { filename, size: blob.size, expiresInHours })

  // Validar parâmetros
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Arquivo inválido. Envie um Blob válido.')
  }

  if (!filename || !filename.endsWith('.pdf')) {
    throw new Error('Nome do arquivo deve terminar com .pdf')
  }

  if (expiresInHours < 1 || expiresInHours > 168) {
    throw new Error('Tempo de expiração deve estar entre 1 e 168 horas')
  }

  // Verificar tamanho máximo (5MB)
  const maxSize = 5 * 1024 * 1024
  if (blob.size > maxSize) {
    throw new Error('Arquivo muito grande. Máximo de 5MB.')
  }

  // Obter token de autenticação
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Usuário não autenticado. Faça login para compartilhar.')
  }

  // Converter Blob para base64
  let base64Data
  try {
    base64Data = await blobToBase64(blob)
    logInfo('Blob convertido para base64', { size: base64Data.length })
  } catch (error) {
    logError('Erro ao converter blob para base64', error)
    throw new Error('Erro ao processar arquivo')
  }

  // Fazer requisição para API
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        blob: base64Data,
        filename,
        expiresInHours,
      }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      const errorMessage = result.error || 'Erro ao compartilhar relatório'
      logWarn('Falha no compartilhamento', { status: response.status, error: errorMessage })
      throw new Error(errorMessage)
    }

    logInfo('Relatório compartilhado com sucesso', { url: result.data?.url?.split('?')[0] })

    return {
      url: result.data.url,
      expiresAt: result.data.expiresAt,
    }
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      logError('Erro de conexão com servidor', error)
      throw new Error('Erro de conexão. Verifique sua internet.')
    }
    throw error
  }
}

/**
 * Compartilha uma URL usando Web Share API nativa
 * Fallback para clipboard se não suportado
 *
 * @param {string} url - URL a ser compartilhada
 * @param {string} [title='Relatório'] - Título do compartilhamento
 * @returns {Promise<boolean>} true se compartilhado com sucesso
 *
 * @example
 * const success = await shareNative(url, 'Meu Relatório de Medicamentos')
 * if (!success) {
 *   // Usuário cancelou ou não suportado
 * }
 */
export async function shareNative(url, title = 'Relatório') {
  logInfo('Tentando compartilhamento nativo', { url: url.split('?')[0], title })

  if (!url) {
    throw new Error('URL é obrigatória')
  }

  // Verificar se Web Share API é suportada
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: `Confira meu ${title.toLowerCase()}`,
        url,
      })
      logInfo('Compartilhamento nativo bem-sucedido')
      return true
    } catch (error) {
      // Usuário cancelou ou erro
      if (error.name === 'AbortError') {
        logInfo('Usuário cancelou compartilhamento')
        return false
      }
      logWarn('Erro no compartilhamento nativo', { error: error.message })
      // Continuar para fallback
    }
  }

  // Fallback para clipboard
  logInfo('Usando fallback para clipboard')
  try {
    await copyToClipboard(url)
    return true
  } catch (error) {
    logError('Fallback de clipboard falhou', error)
    throw new Error('Não foi possível compartilhar. Copie a URL manualmente.')
  }
}

/**
 * Copia uma URL para o clipboard
 * Usa Clipboard API moderna com fallback para método legacy
 *
 * @param {string} url - URL a ser copiada
 * @returns {Promise<void>}
 * @throws {Error} Se não conseguir copiar
 *
 * @example
 * await copyToClipboard('https://example.com/relatorio.pdf')
 * // Mostrar toast: "Link copiado para a área de transferência!"
 */
export async function copyToClipboard(url) {
  logInfo('Copiando para clipboard', { url: url.split('?')[0] })

  if (!url) {
    throw new Error('URL é obrigatória')
  }

  // Tentar Clipboard API moderna
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(url)
      logInfo('URL copiada com Clipboard API')
      return
    } catch (error) {
      logWarn('Clipboard API falhou, tentando fallback', { error: error.message })
    }
  }

  // Fallback para método legacy
  const textArea = document.createElement('textarea')
  textArea.value = url
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  textArea.style.top = '-999999px'
  document.body.appendChild(textArea)

  try {
    textArea.focus()
    textArea.select()

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (successful) {
      logInfo('URL copiada com método legacy')
    } else {
      throw new Error('execCommand retornou false')
    }
  } catch (error) {
    document.body.removeChild(textArea)
    logError('Fallback de clipboard falhou', error)
    throw new Error('Não foi possível copiar o link. Copie manualmente.')
  }
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Converte Blob para string base64
 * @param {Blob} blob - Blob a ser convertido
 * @returns {Promise<string>} String em base64
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result
      // Remover prefixo data:application/pdf;base64, se existir
      const cleanBase64 = base64.replace(/^data:.*?;base64,/, '')
      resolve(cleanBase64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ============================================================================
// EXPORTAÇÕES NOMEADAS E DEFAULT
// ============================================================================

/**
 * Objeto shareService com todas as funções
 */
export const shareService = {
  shareReport,
  shareNative,
  copyToClipboard,
}

export default shareService
