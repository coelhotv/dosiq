/**
 * Memory Storage Adapter
 *
 * Implementacao in-memory para testes e fallback.
 * Dados sao perdidos ao reiniciar a sessao (esperado).
 */

import { assertStorageAdapter, type StorageAdapter } from './contracts.js'

/**
 * Cria um adapter de storage que usa Map em memoria.
 * Util para testes, SSR, e fallback em ambientes sem localStorage.
 * @returns Storage adapter assincronos
 */
export function createMemoryStorageAdapter(): StorageAdapter {
  const store = new Map<string, string>()

  const adapter: StorageAdapter = {
    async getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    async setItem(key: string, value: string) {
      store.set(key, value)
    },
    async removeItem(key: string) {
      store.delete(key)
    },
  }

  assertStorageAdapter(adapter)
  return adapter
}
