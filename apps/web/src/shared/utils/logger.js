/**
 * Logger com suporte a development mode
 * Reduz poluição de console em produção
 *
 * @module logger
 */

const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

/**
 * Log de debug (só em development)
 * @param {string} tag - Prefixo [tag] do log
 * @param {string} message - Mensagem principal
 * @param {...*} args - Dados adicionais (opcionais)
 */
export function debugLog(tag, message, ...args) {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[${tag}] ${message}`, ...args)
  }
}

/**
 * Log de erro/warning (sempre, mas formatado)
 * @param {string} tag - Prefixo [tag]
 * @param {string} message - Mensagem
 * @param {...*} args - Erro opcional e outros dados
 */
export function errorLog(tag, message, ...args) {
  console.error(`[${tag}] ${message}`, ...args)
}

/**
 * Log de aviso (sempre, mas formatado como warning)
 * @param {string} tag - Prefixo [tag]
 * @param {string} message - Mensagem
 * @param {...*} args - Dados adicionais
 */
export function warnLog(tag, message, ...args) {
   
  console.warn(`[${tag}] ${message}`, ...args)
}

/**
 * Log condicional (quando expressão é true)
 * @param {boolean} condition - Condição
 * @param {string} tag - Prefixo
 * @param {string} message - Mensagem
 * @param {...*} args - Dados
 */
export function conditionalLog(condition, tag, message, ...args) {
  if (condition) {
    debugLog(tag, message, ...args)
  }
}
