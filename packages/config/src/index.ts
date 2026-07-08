/**
 * @dosiq/config — Config Management (Fase 3: H3.2)
 *
 * Platform-agnostic config validation and factory.
 * Desacoplado de import.meta.env, process.env, ou qualquer source específico.
 * Config é sempre injetada pelo app-specific bootstrap.
 *
 * Usage:
 *   import { createPublicAppConfig, validatePublicAppConfig } from '@dosiq/config'
 *   const config = createPublicAppConfig({ supabaseUrl: '...', supabaseAnonKey: '...' })
 *   const result = validatePublicAppConfig(config)
 */

export { assertPublicAppConfig } from './contracts.js'
export { createPublicAppConfig } from './createPublicAppConfig.js'
export { validatePublicAppConfig, checkRequiredFields } from './validateConfig.js'
