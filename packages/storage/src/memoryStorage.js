/**
 * Memory Storage Adapter
 *
 * Implementacao in-memory para testes e fallback.
 * Dados sao perdidos ao reiniciar a sessao (esperado).
 */

import { assertStorageAdapter } from './contracts.js'

/**
 * Cria um adapter de storage que usa Map em memoria.
 * Util para testes, SSR, e fallback em ambientes sem localStorage.
 * @returns {Object} Storage adapter assincronos
 */
export function createMemoryStorageAdapter() {
  const store = new Map()

  const adapter = {
    async getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    async setItem(key, value) {
      store.set(key, value)
    },
    async removeItem(key) {
      store.delete(key)
    },
  }

  assertStorageAdapter(adapter)
  return adapter
}
