// packages/core/src/repositories/createBiomarkerRepository.js
// Factory do repositório de biomarcadores (012 Fase C · ADR-060)
// CRUD completo (US3b: detalhe permite Editar/Excluir) + getLatest p/ card "Última medida".

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import {
  validateBiomarkerLog,
  validateBiomarkerLogUpdate,
  BIOMARKER_TYPE_UNITS,
} from '../schemas/biomarkerLogSchema'

const TABLE = 'biomarkers_log'

// Colunas lidas no read-path (R-267) — todas as superfícies (timeline, hub, detalhe).
const SELECT_COLS =
  'id, user_id, type, value, value_secondary, unit, measured_at, context, source, notes, created_at'

interface ValidationError {
  field: string
  message: string
}

function formatValidationError(errors: ValidationError[]) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

interface CreateBiomarkerRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

interface ListOptions {
  type?: string
  fromTs?: string
  toTs?: string
  limit?: number
}

/**
 * Repositório de biomarcadores (glicemia/peso/PA/...). DI cross-platform (web↔mobile, R-231).
 */
export function createBiomarkerRepository({ client, getUserId }: CreateBiomarkerRepositoryDeps) {
  if (!client) throw new Error('createBiomarkerRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createBiomarkerRepository: getUserId deve ser uma função async')
  }

  return {
    /**
     * Lista biomarcadores do usuário, ordenados por instante (mais recente primeiro).
     */
    async list({ type, fromTs, toTs, limit }: ListOptions = {}) {
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
     */
    async getLatest(type?: string) {
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
    async create(biomarker: Record<string, unknown>) {
      const payload: Record<string, unknown> = { ...biomarker }
      if (!payload.unit && payload.type)
        payload.unit = BIOMARKER_TYPE_UNITS[payload.type as keyof typeof BIOMARKER_TYPE_UNITS]

      const validation = validateBiomarkerLog(payload)
      if (!validation.success || !validation.data) throw formatValidationError(validation.errors ?? [])

      const userId = await getUserId()
      // measured_at ausente → coluna usa DEFAULT now() no banco (evita new Date() no core, R-020).
      // Zod aceita string ISO ou Date; a coluna é timestamptz (string) — normaliza antes do insert.
      const { measured_at, ...restRow } = validation.data
      // `value` explícito: obrigatório no schema, mas a inferência Zod sob programas
      // non-strict (api/tsconfig) o marca opcional e quebra o tipo Insert gerado.
      const row = {
        ...restRow,
        value: validation.data.value,
        ...(measured_at != null
          ? { measured_at: measured_at instanceof Date ? measured_at.toISOString() : measured_at }
          : {}),
        user_id: userId,
      }

      const { data, error } = await client
        .from(TABLE)
        .insert([row])
        .select(SELECT_COLS)
        .single()

      if (error) throw error
      return data
    },

    /** Atualiza parcialmente um biomarcador (edição no detalhe). RLS garante posse. */
    async update(id: string, patch: Record<string, unknown>) {
      if (!id) throw new Error('update: id é obrigatório')
      const validation = validateBiomarkerLogUpdate(patch)
      if (!validation.success || !validation.data) throw formatValidationError(validation.errors ?? [])

      const userId = await getUserId()
      const { measured_at: patchMeasuredAt, ...restPatch } = validation.data
      const updateRow = {
        ...restPatch,
        ...(patchMeasuredAt != null
          ? { measured_at: patchMeasuredAt instanceof Date ? patchMeasuredAt.toISOString() : patchMeasuredAt }
          : {}),
      }
      const { data, error } = await client
        .from(TABLE)
        .update(updateRow)
        .eq('id', id)
        .eq('user_id', userId)
        .select(SELECT_COLS)
        .single()

      if (error) throw error
      return data
    },

    /** Exclui um biomarcador. RLS garante posse. */
    async remove(id: string) {
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
