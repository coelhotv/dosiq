/**
 * Config Validator
 *
 * Funcoes de validacao sem lançar erro (retornam resultado safe).
 * Util para logging e diagnostico.
 */

import { assertPublicAppConfig, type PublicAppConfigCandidate } from './contracts'

/**
 * Valida config pública sem lançar erro.
 * Retorna {valid: true} ou {valid: false, error: string}
 *
 * @param config - Config a validar
 * @returns {valid: boolean, error?: string}
 */
export function validatePublicAppConfig(config: PublicAppConfigCandidate | null | undefined) {
  try {
    assertPublicAppConfig(config)
    return { valid: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { valid: false, error: message }
  }
}

/**
 * Valida se um objeto tem os campos minimos (sem lancar erro).
 *
 * @param input - Objeto a verificar
 * @returns {hasAll: boolean, missing: string[]}
 */
export function checkRequiredFields(input: Record<string, unknown> | null | undefined) {
  const required = ['supabaseUrl', 'supabaseAnonKey']
  const missing = required.filter((field) => !input?.[field])

  return {
    hasAll: missing.length === 0,
    missing,
  }
}
