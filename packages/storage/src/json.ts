/**
 * JSON Storage Helpers
 *
 * Funções auxiliares para ler/escrever JSON usando qualquer adapter de storage.
 * Usa try-catch para fallback seguro em caso de parse error.
 */

import type { StorageAdapter } from './contracts'

/**
 * Le um valor JSON do storage.
 * @param adapter - Storage adapter (deve implementar getItem)
 * @param key - Chave de armazenamento
 * @param fallback - Valor padrao se chave nao existir ou JSON for invalido
 * @returns Valor desserializado ou fallback
 */
export async function getJSON<T = unknown>(
  adapter: Pick<StorageAdapter, 'getItem'>,
  key: string,
  fallback: T | null = null
): Promise<T | null> {
  const raw = await adapter.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    // Ignorar parse error e retornar fallback
    return fallback
  }
}

/**
 * Escreve um valor JSON no storage.
 * @param adapter - Storage adapter (deve implementar setItem)
 * @param key - Chave de armazenamento
 * @param value - Valor a serializar
 * @throws {Error} Se JSON.stringify ou adapter.setItem falharem
 */
export async function setJSON(
  adapter: Pick<StorageAdapter, 'setItem'>,
  key: string,
  value: unknown
): Promise<void> {
  try {
    const serialized = JSON.stringify(value)
    await adapter.setItem(key, serialized)
  } catch (error) {
    // Log error para debugging (mesmo que falha seja silenciosa para caller)
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[setJSON] Failed to store key "${key}":`, message)
    throw error
  }
}
