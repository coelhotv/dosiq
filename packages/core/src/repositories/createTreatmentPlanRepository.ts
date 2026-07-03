// createTreatmentPlanRepository.js — Factory CRUD canônico de planos terapêuticos (Fase 2 G2).
//
// Web e mobile injetam: client Supabase, getUserId, e (opcional) selects/transforms.
// Default selects incluem protocolos aninhados (necessário para agrupamento web/mobile).
// Sem validação Zod — treatmentPlanSchema canônico não existe ainda; fora de escopo desta task.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'

const identity = <T,>(x: T) => x

const DEFAULT_SELECT = '*, protocols:protocols(*, medicine:medicines(*))'

interface CreateTreatmentPlanRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
  listSelect?: string
  detailSelect?: string
  listTransform?: (rows: unknown) => unknown
  detailTransform?: (row: unknown) => unknown
}

/**
 * Cria um repositório CRUD de planos terapêuticos parametrizado por plataforma.
 */
export function createTreatmentPlanRepository({
  client,
  getUserId,
  listSelect = DEFAULT_SELECT,
  detailSelect = DEFAULT_SELECT,
  listTransform = identity,
  detailTransform = identity,
}: CreateTreatmentPlanRepositoryDeps) {
  if (!client) throw new Error('createTreatmentPlanRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createTreatmentPlanRepository: getUserId deve ser função async')
  }

  return {
    async getAll() {
      const userId = await getUserId()
      const { data, error } = await client
        .from('treatment_plans')
        .select(listSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return listTransform(data ?? [])
    },

    async getById(id: string) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('treatment_plans')
        .select(detailSelect)
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async create(plan: Record<string, unknown>) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('treatment_plans')
        .insert([{ ...plan, user_id: userId }] as never)
        .select()
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async update(id: string, updates: Record<string, unknown>) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('treatment_plans')
        .update(updates as never)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async delete(id: string) {
      // Nota: protocolos associados têm treatment_plan_id setado para NULL via ON DELETE SET NULL.
      const userId = await getUserId()
      const { error } = await client
        .from('treatment_plans')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
  }
}
