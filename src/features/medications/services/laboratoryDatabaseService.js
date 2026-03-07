/**
 * Serviço de busca na base de laboratórios ANVISA.
 *
 * Dados carregados via lazy import do JSON estático.
 * Busca por nome de laboratório com normalização de acentos.
 *
 * PRINCÍPIO: Zero chamadas ao Supabase — dados pré-carregados do JSON local.
 */

let _database = null

/**
 * Carrega a base sob demanda (lazy loading para não impactar bundle inicial).
 * @returns {Promise<Array>}
 */
async function loadDatabase() {
  if (!_database) {
    try {
      const module = await import('@medications/data/laboratoryDatabase.json')
      _database = module.default
    } catch (error) {
      console.error('Erro ao carregar laboratoryDatabase.json:', error)
      throw error
    }
  }
  return _database
}

/**
 * Normaliza texto para busca (remove acentos, lowercase).
 * @param {string} text - Texto a normalizar
 * @returns {string}
 */
function normalizeText(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
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

  const db = await loadDatabase()
  const normalizedQuery = normalizeText(query)

  const results = db
    .filter(lab => normalizeText(lab.laboratory).includes(normalizedQuery))
    .slice(0, limit)

  return results
}

/**
 * Retorna um laboratório específico por nome exato.
 *
 * @param {string} name - Nome exato do laboratório
 * @returns {Promise<Object|null>}
 */
export async function getLaboratoryByName(name) {
  if (!name) return null

  const db = await loadDatabase()
  const normalizedName = normalizeText(name)

  return db.find(lab => normalizeText(lab.laboratory) === normalizedName) || null
}

/**
 * Retorna todos os laboratórios (útil para pré-carregamento em offline).
 *
 * @returns {Promise<Array>}
 */
export async function getAllLaboratories() {
  return await loadDatabase()
}
