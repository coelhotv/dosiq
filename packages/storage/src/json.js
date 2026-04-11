/**
 * JSON Storage Helpers
 *
 * Funções auxiliares para ler/escrever JSON usando qualquer adapter de storage.
 * Usa try-catch para fallback seguro em caso de parse error.
 */

/**
 * Le um valor JSON do storage.
 * @param {Object} adapter - Storage adapter (deve implementar getItem)
 * @param {string} key - Chave de armazenamento
 * @param {*} fallback - Valor padrao se chave nao existir ou JSON for invalido
 * @returns {Promise<*>} Valor desserializado ou fallback
 */
export async function getJSON(adapter, key, fallback = null) {
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
 * @param {Object} adapter - Storage adapter (deve implementar setItem)
 * @param {string} key - Chave de armazenamento
 * @param {*} value - Valor a serializar
 * @returns {Promise<void>}
 * @throws {Error} Se JSON.stringify ou adapter.setItem falharem
 */
export async function setJSON(adapter, key, value) {
  try {
    const serialized = JSON.stringify(value)
    await adapter.setItem(key, serialized)
  } catch (error) {
    // Log error para debugging (mesmo que falha seja silenciosa para caller)
    console.error(`[setJSON] Failed to store key "${key}":`, error.message)
    throw error
  }
}
