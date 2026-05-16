// createMedicineRepository.js — Factory CRUD canônico de medicamentos (Fase 1 G2).
//
// Web e mobile injetam: client Supabase, getUserId, e (opcional) selects/transforms.
// Default selects = '*'; default transforms = identity.
// Validação Zod create/update é canônica (via @dosiq/core medicineSchema) — não parametrizável.

import { validateMedicineCreate, validateMedicineUpdate } from '../schemas/medicineSchema.js'

const identity = (x) => x

function formatValidationError(errors) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

/**
 * Cria um repositório CRUD de medicamentos parametrizado por plataforma.
 *
 * @param {Object} deps
 * @param {Object} deps.client       Cliente Supabase (`createClient(...)` ou nativeSupabaseClient).
 * @param {Function} deps.getUserId  Async () => string. Resolve user_id da sessão.
 * @param {string}   [deps.listSelect='*']    Select fragment usado em getAll.
 * @param {string}   [deps.detailSelect='*']  Select fragment usado em getById.
 * @param {Function} [deps.listTransform]     (rows) => rows. Pós-processamento de getAll.
 * @param {Function} [deps.detailTransform]   (row) => row. Pós-processamento de getById.
 * @returns {{
 *   getAll: () => Promise<Array>,
 *   getById: (id: string) => Promise<Object>,
 *   create: (medicine: Object) => Promise<Object>,
 *   update: (id: string, updates: Object) => Promise<Object>,
 *   delete: (id: string) => Promise<void>,
 * }}
 */
export function createMedicineRepository({
  client,
  getUserId,
  listSelect = '*',
  detailSelect = '*',
  listTransform = identity,
  detailTransform = identity,
}) {
  if (!client) throw new Error('createMedicineRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createMedicineRepository: getUserId deve ser função async')
  }

  return {
    async getAll() {
      const userId = await getUserId()
      const { data, error } = await client
        .from('medicines')
        .select(listSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return listTransform(data ?? [])
    },

    async getById(id) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('medicines')
        .select(detailSelect)
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async create(medicine) {
      const validation = validateMedicineCreate(medicine)
      if (!validation.success) throw formatValidationError(validation.errors)

      const userId = await getUserId()
      const { data, error } = await client
        .from('medicines')
        .insert([{ ...validation.data, user_id: userId }])
        .select()
        .single()

      if (error) throw error
      return data
    },

    async update(id, updates) {
      const validation = validateMedicineUpdate(updates)
      if (!validation.success) throw formatValidationError(validation.errors)

      const userId = await getUserId()
      const { data, error } = await client
        .from('medicines')
        .update(validation.data)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    },

    async delete(id) {
      const userId = await getUserId()
      const { error } = await client
        .from('medicines')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
  }
}
