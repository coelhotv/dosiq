/**
 * Public App Config Factory
 *
 * Cria e valida a config pública da aplicacao.
 * A injecao de valores acontece fora deste pacote (no app-specific bootstrap).
 */

import { assertPublicAppConfig } from './contracts.js'

/**
 * Cria um objeto de config pública validado.
 * Nao lê import.meta.env, process.env, ou qualquer env var directamente.
 * Valores devem ser injetados pelo app-specific bootstrap.
 *
 * @param {Object} input - Valores de entrada (injetados por quem chama)
 * @returns {Object} Config pública validada
 * @throws {Error} Se algum valor obrigatório estiver faltando ou invalido
 */
export function createPublicAppConfig(input) {
  const config = {
    supabaseUrl: input.supabaseUrl,
    supabaseAnonKey: input.supabaseAnonKey,
    detectSessionInUrl: Boolean(input.detectSessionInUrl ?? true),
    appEnv: input.appEnv ?? 'development',
  }

  assertPublicAppConfig(config)
  return config
}
