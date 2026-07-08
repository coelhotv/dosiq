/**
 * Storage Adapter Contract
 *
 * All platform-specific storage implementations (web, mobile, server) must conform to this interface.
 * Async-first design ensures compatibility across all platforms.
 */

/**
 * Interface que todo storage adapter (web/mobile/server) deve implementar.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/**
 * Assert that an object implements the storage adapter interface.
 * @param adapter - Candidato para adapter de storage
 * @throws {Error} Se adapter não tiver os métodos obrigatórios
 */
export function assertStorageAdapter(
  adapter: Partial<StorageAdapter> | null | undefined
): asserts adapter is StorageAdapter {
  if (!adapter) throw new Error('Storage adapter is required')

  const required = ['getItem', 'setItem', 'removeItem'] as const

  for (const method of required) {
    if (typeof adapter[method] !== 'function') {
      throw new Error(`Storage adapter missing method: ${method}`)
    }
  }
}

/**
 * Storage Adapter Interface (TypeScript-style documentation)
 *
 * Implementadores DEVEM prover:
 * - async getItem(key: string): Promise<string | null>
 * - async setItem(key: string, value: string): Promise<void>
 * - async removeItem(key: string): Promise<void>
 *
 * Exemplos:
 * - Web: wraps window.localStorage
 * - Mobile: wraps AsyncStorage (React Native)
 * - Server: wraps Map (memory) ou Redis
 */
