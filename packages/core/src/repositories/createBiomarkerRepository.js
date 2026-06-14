// packages/core/src/repositories/createBiomarkerRepository.js
// Factory do repositório de biomarcadores (012 Fase C · ADR-060)
// CRUD completo (US3b: detalhe permite Editar/Excluir) + getLatest p/ card "Última medida".

import {
  validateBiomarkerLog,
  validateBiomarkerLogUpdate,
  BIOMARKER_TYPE_UNITS,
} from '../schemas/biomarkerLogSchema.js'

const TABLE = 'biomarkers_log'

// Colunas lidas no read-path (R-267) — todas as superfícies (timeline, hub, detalhe).
const SELECT_COLS =
  'id, user_id, type, value, value_secondary, unit, measured_at, context, source, notes, created_at'

function formatValidationError(errors) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

/**
 * Repositório de biomarcadores (glicemia/peso/PA/...). DI cross-platform (web↔mobile, R-231).
 *
 * @param {Object} deps
 * @param {Object} deps.client       Cliente Supabase.
 * @param {Function} deps.getUserId  Async () => string. user_id autenticado.
 */
export function createBiomarkerRepository({ client, getUserId }) {
  if (!client) throw new Error('createBiomarkerRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createBiomarkerRepository: getUserId deve ser uma função async')
  }

  return {
    /**
     * Lista biomarcadores do usuário, ordenados por instante (mais recente primeiro).
     * @param {Object} [opts]
     * @param {string} [opts.type]   Filtra por tipo (glicemia/peso/...).
     * @param {string} [opts.fromTs] ISO — limite inferior de measured_at (inclusive).
     * @param {string} [opts.toTs]   ISO — limite superior de measured_at (exclusivo).
     * @param {number} [opts.limit]
     */
    async list({ type, fromTs, toTs, limit } = {}) {
      const userId = await getUserId()
      let q = client
        .from(TABLE)
        .select(SELECT_COLS)
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })

      if (type) q = q.eq('type', type)
      if (fromTs) q = q.gte('measured_at', fromTs)
      if (toTs) q = q.lt('measured_at', toTs)
      if (limit) q = q.limit(limit)

      const { data, error } = await q
      if (error) throw error
      return data || []
    },

    /**
     * Última medida registrada (global ou por tipo) — alimenta o card "Última medida" do Hoje.
     * @param {string} [type]
     * @returns {Promise<Object|null>}
     */
    async getLatest(type) {
      const userId = await getUserId()
      let q = client
        .from(TABLE)
        .select(SELECT_COLS)
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })
        .limit(1)

      if (type) q = q.eq('type', type)

      const { data, error } = await q
      if (error) throw error
      return data?.[0] || null
    },

    /** Cria um biomarcador. measured_at default = agora; unit default = unidade fixa do tipo. */
    async create(biomarker) {
      const payload = { ...biomarker }
      if (!payload.unit && payload.type) payload.unit = BIOMARKER_TYPE_UNITS[payload.type]

      const validation = validateBiomarkerLog(payload)
      if (!validation.success) throw formatValidationError(validation.errors)

      const userId = await getUserId()
      // measured_at ausente → coluna usa DEFAULT now() no banco (evita new Date() no core, R-020).
      const row = { ...validation.data, user_id: userId }

      const { data, error } = await client
        .from(TABLE)
        .insert([row])
        .select(SELECT_COLS)
        .single()

      if (error) throw error
      return data
    },

    /** Atualiza parcialmente um biomarcador (edição no detalhe). RLS garante posse. */
    async update(id, patch) {
      if (!id) throw new Error('update: id é obrigatório')
      const validation = validateBiomarkerLogUpdate(patch)
      if (!validation.success) throw formatValidationError(validation.errors)

      const userId = await getUserId()
      const { data, error } = await client
        .from(TABLE)
        .update(validation.data)
        .eq('id', id)
        .eq('user_id', userId)
        .select(SELECT_COLS)
        .single()

      if (error) throw error
      return data
    },

    /** Exclui um biomarcador. RLS garante posse. */
    async remove(id) {
      if (!id) throw new Error('remove: id é obrigatório')
      const userId = await getUserId()
      const { error } = await client
        .from(TABLE)
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return true
    },
  }
}
