/**
 * Public App Config Factory
 *
 * Cria e valida a config pública da aplicacao.
 * A injecao de valores acontece fora deste pacote (no app-specific bootstrap).
 */

import { assertPublicAppConfig } from './contracts'

/**
 * Valores de entrada aceitos pela factory (injetados por quem chama).
 * Campos opcionais na entrada porque vêm de env vars (`process.env.X` é
 * `string|undefined`) — `assertPublicAppConfig` abaixo falha alto se faltarem.
 */
export interface PublicAppConfigInput {
  supabaseUrl?: string
  supabaseAnonKey?: string
  detectSessionInUrl?: boolean
  appEnv?: string
}

/** Config pública já validada (pós `assertPublicAppConfig` — campos obrigatórios). */
export interface PublicAppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  detectSessionInUrl: boolean
  appEnv: string
}

/**
 * Cria um objeto de config pública validado.
 * Nao lê import.meta.env, process.env, ou qualquer env var directamente.
 * Valores devem ser injetados pelo app-specific bootstrap.
 *
 * @param input - Valores de entrada (injetados por quem chama)
 * @returns Config pública validada
 * @throws {Error} Se algum valor obrigatório estiver faltando ou invalido
 */
export function createPublicAppConfig(input: PublicAppConfigInput): PublicAppConfig {
  // Cast seguro: assertPublicAppConfig (abaixo) falha alto se supabaseUrl/supabaseAnonKey
  // vierem ausentes — o cast só reflete o contrato JÁ garantido em runtime pelo assert.
  const config = {
    supabaseUrl: input.supabaseUrl as string,
    supabaseAnonKey: input.supabaseAnonKey as string,
    detectSessionInUrl: Boolean(input.detectSessionInUrl ?? true),
    appEnv: input.appEnv ?? 'development',
  }

  assertPublicAppConfig(config)
  return config
}
