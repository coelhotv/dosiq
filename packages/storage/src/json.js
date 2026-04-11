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
 */
export async function setJSON(adapter, key, value) {
  await adapter.setItem(key, JSON.stringify(value))
}
