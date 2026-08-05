/**
 * Serviço de busca na base de medicamentos ANVISA.
 *
 * On-demand (037): os dados vêm do Supabase Storage público via o núcleo
 * `createAnvisaDatabase` de `@dosiq/core` (CON-027), com cache na Cache Storage API
 * (versionado por manifest + TTL 7d). Não há mais import do JSON no bundle.
 *
 * Degradação graciosa: falha de rede sem cache ⇒ base vazia (autocomplete vazio,
 * form segue utilizável), sem throw para o caller. API pública inalterada (FR-004).
 */

import { createAnvisaDatabase, normalizeText } from '@dosiq/core'
import { createCacheStorageAdapter } from '@medications/services/_cacheStorageAdapter'

const ANVISA_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/dosiq-assets/anvisa/v1`

const db = createAnvisaDatabase({
  baseUrl: ANVISA_BASE_URL,
  fileKey: 'medicineDatabase',
  storageAdapter: createCacheStorageAdapter(),
})

/**
 * Carrega a base sob demanda (Storage + cache). Nunca lança: offline sem cache ⇒ [].
 * @returns {Promise<Array>}
 */
async function loadDatabase(): Promise<any[]> {
  return db.load()
}

/**
 * Busca medicamentos por termo (nome ou princípio ativo).
 *
 * @param {string} query - Termo de busca (mínimo 1 caractere para iniciar, recomendado 3+)
 * @param {number} limit - Máximo de resultados (default: 10)
 * @returns {Promise<Array<{name, activeIngredient, therapeuticClass, regulatoryCategory}>>}
 */
export async function searchMedicines(query, limit = 10) {
  if (!query || query.trim().length < 3) return []

  const data = await loadDatabase()
  const normalizedQuery = normalizeText(query)

  return data
    .filter(
      (med) =>
        normalizeText(med.name).includes(normalizedQuery) ||
        normalizeText(med.activeIngredient).includes(normalizedQuery)
    )
    .slice(0, limit)
}

/**
 * Retorna detalhes de um medicamento específico.
 *
 * @param {string} name - Nome exato (ou parcial) do medicamento
 * @returns {Promise<Object|null>}
 */
export async function getMedicineDetails(name) {
  if (!name) return null

  const data = await loadDatabase()
  const normalizedName = normalizeText(name)

  // Match exato (normalizado) primeiro; senão match parcial.
  let medicine = data.find((med) => normalizeText(med.name) === normalizedName)
  if (!medicine) {
    medicine = data.find((med) => normalizeText(med.name).includes(normalizedName))
  }

  return medicine || null
}

/**
 * Busca medicamentos por princípio ativo específico.
 *
 * @param {string} activeIngredient - Princípio ativo
 * @returns {Promise<Array<{name, activeIngredient, therapeuticClass, regulatoryCategory}>>}
 */
export async function searchByActiveIngredient(activeIngredient) {
  if (!activeIngredient) return []

  const data = await loadDatabase()
  const normalizedIngredient = normalizeText(activeIngredient)

  return data.filter((med) => normalizeText(med.activeIngredient) === normalizedIngredient)
}

/**
 * Retorna todos os medicamentos (útil para pré-carregamento em offline).
 * USE COM CUIDADO: Retorna ~6.9k medicamentos — considere usar com pagination.
 *
 * @returns {Promise<Array>}
 */
export async function getAllMedicines() {
  return loadDatabase()
}

/**
 * Deduplicador: Verifica se um medicamento com o mesmo princípio ativo já existe.
 * Útil para evitar cadastros duplicados com diferentes nomes comerciais.
 *
 * @param {string} activeIngredient - Princípio ativo
 * @param {string} excludeName - Nome comercial a excluir da busca (para edição)
 * @returns {Promise<Array<{name, activeIngredient, regulatoryCategory}>>}
 */
export async function findDuplicatesByIngredient(activeIngredient, excludeName = null) {
  const medicines = await searchByActiveIngredient(activeIngredient)

  if (excludeName) {
    return medicines.filter((med) => normalizeText(med.name) !== normalizeText(excludeName))
  }

  return medicines
}
