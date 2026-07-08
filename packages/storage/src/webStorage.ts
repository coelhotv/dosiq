/**
 * Web Storage Adapter
 *
 * Wraps window.localStorage com interface assincorna.
 * Injetável em packages/shared-data sem acoplamento direto a window.
 */

import { assertStorageAdapter, type StorageAdapter } from './contracts.js'

/** Superfície mínima de Storage usada pelo adapter (aceita fallbacks de teste). */
export interface WebStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Cria um adapter de storage que wraps window.localStorage.
 * @param storage - window.localStorage ou window.sessionStorage
 * @returns Storage adapter com métodos assincronos
 */
export function createWebStorageAdapter(storage: WebStorageLike): StorageAdapter {
  if (!storage) throw new Error('Web storage provider is required')

  const adapter: StorageAdapter = {
    async getItem(key: string) {
      return storage.getItem(key)
    },
    async setItem(key: string, value: string) {
      storage.setItem(key, value)
    },
    async removeItem(key: string) {
      storage.removeItem(key)
    },
  }

  assertStorageAdapter(adapter)
  return adapter
}
