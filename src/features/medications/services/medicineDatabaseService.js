/**
 * Serviço de busca na base de medicamentos ANVISA.
 *
 * Dados carregados via lazy import do JSON estático.
 * Busca por nome comercial ou princípio ativo com normalização de acentos.
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
      const module = await import('@medications/data/medicineDatabase.json')
      _database = module.default
    } catch (error) {
      console.error('Erro ao carregar medicineDatabase.json:', error)
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
 * Busca medicamentos por termo (nome ou princípio ativo).
 *
 * @param {string} query - Termo de busca (mínimo 1 caractere para iniciar, recomendado 3+)
 * @param {number} limit - Máximo de resultados (default: 10)
 * @returns {Promise<Array<{name, activeIngredient, therapeuticClass}>>}
 */
export async function searchMedicines(query, limit = 10) {
  if (!query || query.trim().length < 3) return []

  const db = await loadDatabase()
  const normalizedQuery = normalizeText(query)

  // Filtrar por nome ou princípio ativo
  const results = db
    .filter(
      (med) =>
        normalizeText(med.name).includes(normalizedQuery) ||
        normalizeText(med.activeIngredient).includes(normalizedQuery)
    )
    .slice(0, limit)

  return results
}

/**
 * Retorna detalhes de um medicamento específico.
 *
 * @param {string} name - Nome exato (ou parcial) do medicamento
 * @returns {Promise<Object|null>}
 */
export async function getMedicineDetails(name) {
  if (!name) return null

  const db = await loadDatabase()
  const normalizedName = normalizeText(name)

  // Buscar por match exato (normalizado) primeiro
  let medicine = db.find((med) => normalizeText(med.name) === normalizedName)

  // Se não encontrar exato, buscar por match parcial
  if (!medicine) {
    medicine = db.find((med) => normalizeText(med.name).includes(normalizedName))
  }

  return medicine || null
}

/**
 * Busca medicamentos por princípio ativo específico.
 *
 * @param {string} activeIngredient - Princípio ativo
 * @returns {Promise<Array<{name, activeIngredient, therapeuticClass}>>}
 */
export async function searchByActiveIngredient(activeIngredient) {
  if (!activeIngredient) return []

  const db = await loadDatabase()
  const normalizedIngredient = normalizeText(activeIngredient)

  return db.filter((med) => normalizeText(med.activeIngredient) === normalizedIngredient)
}

/**
 * Retorna todos os medicamentos (útil para pré-carregamento em offline).
 * USE COM CUIDADO: Retorna 6.816 medicamentos — considere usar com pagination.
 *
 * @returns {Promise<Array>}
 */
export async function getAllMedicines() {
  return await loadDatabase()
}

/**
 * Deduplicador: Verifica se um medicamento com o mesmo princípio ativo já existe.
 * Útil para evitar cadastros duplicados com diferentes nomes comerciais.
 *
 * @param {string} activeIngredient - Princípio ativo
 * @param {string} excludeName - Nome comercial a excluir da busca (para edição)
 * @returns {Promise<Array<{name, activeIngredient}>>}
 */
export async function findDuplicatesByIngredient(activeIngredient, excludeName = null) {
  const medicines = await searchByActiveIngredient(activeIngredient)

  if (excludeName) {
    return medicines.filter((med) => normalizeText(med.name) !== normalizeText(excludeName))
  }

  return medicines
}
