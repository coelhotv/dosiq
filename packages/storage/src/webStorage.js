/**
 * Web Storage Adapter
 *
 * Wraps window.localStorage com interface assincorna.
 * Injetável em packages/shared-data sem acoplamento direto a window.
 */

import { assertStorageAdapter } from './contracts.js'

/**
 * Cria um adapter de storage que wraps window.localStorage.
 * @param {Storage} storage - window.localStorage ou window.sessionStorage
 * @returns {Object} Storage adapter com métodos assincronos
 */
export function createWebStorageAdapter(storage) {
  if (!storage) throw new Error('Web storage provider is required')

  const adapter = {
    async getItem(key) {
      return storage.getItem(key)
    },
    async setItem(key, value) {
      storage.setItem(key, value)
    },
    async removeItem(key) {
      storage.removeItem(key)
    },
  }

  assertStorageAdapter(adapter)
  return adapter
}
