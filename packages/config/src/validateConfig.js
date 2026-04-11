/**
 * Config Validator
 *
 * Funcoes de validacao sem lançar erro (retornam resultado safe).
 * Util para logging e diagnostico.
 */

import { assertPublicAppConfig } from './contracts.js'

/**
 * Valida config pública sem lançar erro.
 * Retorna {valid: true} ou {valid: false, error: string}
 *
 * @param {Object} config - Config a validar
 * @returns {Object} {valid: boolean, error?: string}
 */
export function validatePublicAppConfig(config) {
  try {
    assertPublicAppConfig(config)
    return { valid: true }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}

/**
 * Valida se um objeto tem os campos minimos (sem lancar erro).
 *
 * @param {Object} input - Objeto a verificar
 * @returns {Object} {hasAll: boolean, missing: string[]}
 */
export function checkRequiredFields(input) {
  const required = ['supabaseUrl', 'supabaseAnonKey']
  const missing = required.filter((field) => !input?.[field])

  return {
    hasAll: missing.length === 0,
    missing,
  }
}
