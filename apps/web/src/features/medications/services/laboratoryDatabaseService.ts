/**
 * Serviço de busca na base de laboratórios ANVISA.
 *
 * On-demand (037): dados do Supabase Storage público via `createAnvisaDatabase`
 * de `@dosiq/core` (CON-027), cache na Cache Storage API. Sem import do JSON no bundle.
 * Degradação graciosa: offline sem cache ⇒ base vazia, sem throw. API pública inalterada.
 */

import { createAnvisaDatabase, normalizeText } from '@dosiq/core'
import { createCacheStorageAdapter } from '@medications/services/_cacheStorageAdapter'

const ANVISA_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/dosiq-assets/anvisa/v1`

const db = createAnvisaDatabase({
  baseUrl: ANVISA_BASE_URL,
  fileKey: 'laboratoryDatabase',
  storageAdapter: createCacheStorageAdapter(),
})

/**
 * Carrega a base sob demanda (Storage + cache). Nunca lança: offline sem cache ⇒ [].
 * @returns {Promise<Array>}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(040-strict) tipar createAnvisaDatabase
async function loadDatabase(): Promise<any[]> {
  return db.load()
}

/**
 * Busca laboratórios por termo.
 *
 * @param {string} query - Termo de busca
 * @param {number} limit - Máximo de resultados (default: 10)
 * @returns {Promise<Array<{laboratory}>>}
 */
export async function searchLaboratories(query, limit = 10) {
  if (!query || query.trim().length < 3) return []

  const data = await loadDatabase()
  const normalizedQuery = normalizeText(query)

  return data
    .filter((lab) => normalizeText(lab.laboratory).includes(normalizedQuery))
    .slice(0, limit)
}

/**
 * Retorna um laboratório específico por nome exato.
 *
 * @param {string} name - Nome exato do laboratório
 * @returns {Promise<Object|null>}
 */
export async function getLaboratoryByName(name) {
  if (!name) return null

  const data = await loadDatabase()
  const normalizedName = normalizeText(name)

  return data.find((lab) => normalizeText(lab.laboratory) === normalizedName) || null
}

/**
 * Retorna todos os laboratórios (útil para pré-carregamento em offline).
 *
 * @returns {Promise<Array>}
 */
export async function getAllLaboratories() {
  return loadDatabase()
}
