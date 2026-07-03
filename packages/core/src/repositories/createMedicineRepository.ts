// createMedicineRepository.js — Factory CRUD canônico de medicamentos (Fase 1 G2).
//
// Web e mobile injetam: client Supabase, getUserId, e (opcional) selects/transforms.
// Default selects = '*'; default transforms = identity.
// Validação Zod create/update é canônica (via @dosiq/core medicineSchema) — não parametrizável.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { validateMedicineCreate, validateMedicineUpdate } from '../schemas/medicineSchema'

const identity = <T,>(x: T) => x

interface ValidationError {
  field: string
  message: string
}

function formatValidationError(errors: ValidationError[]) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

interface CreateMedicineRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
  listSelect?: string
  detailSelect?: string
  listTransform?: (rows: unknown) => unknown
  detailTransform?: (row: unknown) => unknown
}

/**
 * Cria um repositório CRUD de medicamentos parametrizado por plataforma.
 */
export function createMedicineRepository({
  client,
  getUserId,
  listSelect = '*',
  detailSelect = '*',
  listTransform = identity,
  detailTransform = identity,
}: CreateMedicineRepositoryDeps) {
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

    async getById(id: string) {
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

    async create(medicine: Record<string, unknown>) {
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

    async update(id: string, updates: Record<string, unknown>) {
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

    async delete(id: string) {
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
