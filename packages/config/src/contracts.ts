/**
 * Public App Config Contract
 *
 * Config publica (Supabase URL, anon key, etc) deve estar presente e valida.
 * Todos os valores sao injetados pelo app-specific bootstrap (web, mobile).
 */

/**
 * Valida que um objeto contém todos os valores obrigatórios de config pública.
 * @param {Object} config - Candidato para config pública
 * @throws {Error} Se algum campo obrigatório estiver faltando ou invalido
 */
export function assertPublicAppConfig(config) {
  if (!config) throw new Error('Config object is required')

  if (!config.supabaseUrl) {
    throw new Error('Missing supabaseUrl in public config')
  }

  if (!config.supabaseAnonKey) {
    throw new Error('Missing supabaseAnonKey in public config')
  }

  // URL must start with https
  if (typeof config.supabaseUrl !== 'string' || !config.supabaseUrl.startsWith('https://')) {
    throw new Error('supabaseUrl must be a valid HTTPS URL')
  }

  // Anon key should be a non-empty string (no format validation; Supabase handles that)
  if (typeof config.supabaseAnonKey !== 'string' || config.supabaseAnonKey.length === 0) {
    throw new Error('supabaseAnonKey must be a non-empty string')
  }
}

/**
 * Public App Config Interface (TypeScript-style documentation)
 *
 * Shape minimo:
 * {
 *   supabaseUrl: string (https://...)
 *   supabaseAnonKey: string (non-empty)
 *   detectSessionInUrl?: boolean
 *   appEnv?: 'development' | 'production'
 * }
 *
 * Injecao obrigatoria: app-specific bootstrap (nao em packages/config)
 * - Web: le de import.meta.env e injeta
 * - Mobile: le de native env e injeta
 * - Server: le de process.env e injeta
 */
