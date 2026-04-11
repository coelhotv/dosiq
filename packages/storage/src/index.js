/**
 * @meus-remedios/storage — Storage Adapter Layer (Fase 3: H3.1)
 *
 * Platform-agnostic, async-first storage interface.
 * Desacoplado de window.localStorage, AsyncStorage, ou qualquer storage específico de plataforma.
 *
 * Usage:
 *   import { createWebStorageAdapter, getJSON, setJSON } from '@meus-remedios/storage'
 *   const adapter = createWebStorageAdapter(window.localStorage)
 *   await adapter.setItem('key', 'value')
 *   const value = await adapter.getItem('key')
 *   const json = await getJSON(adapter, 'jsonKey', defaultValue)
 */

export { assertStorageAdapter } from './contracts.js'
export { createWebStorageAdapter } from './webStorage.js'
export { createMemoryStorageAdapter } from './memoryStorage.js'
export { getJSON, setJSON } from './json.js'
