// createTreatmentPlanRepository.js — Factory CRUD canônico de planos terapêuticos (Fase 2 G2).
//
// Web e mobile injetam: client Supabase, getUserId, e (opcional) selects/transforms.
// Default selects incluem protocolos aninhados (necessário para agrupamento web/mobile).
// Sem validação Zod — treatmentPlanSchema canônico não existe ainda; fora de escopo desta task.

const identity = (x) => x

const DEFAULT_SELECT = '*, protocols:protocols(*, medicine:medicines(*))'

/**
 * Cria um repositório CRUD de planos terapêuticos parametrizado por plataforma.
 *
 * @param {Object} deps
 * @param {Object} deps.client       Cliente Supabase (`createClient(...)` ou nativeSupabaseClient).
 * @param {Function} deps.getUserId  Async () => string. Resolve user_id da sessão.
 * @param {string}   [deps.listSelect]    Select fragment usado em getAll. Default: join completo com protocolos.
 * @param {string}   [deps.detailSelect]  Select fragment usado em getById. Default: join completo com protocolos.
 * @param {Function} [deps.listTransform]     (rows) => rows. Pós-processamento de getAll.
 * @param {Function} [deps.detailTransform]   (row) => row. Pós-processamento de getById.
 * @returns {{
 *   getAll: () => Promise<Array>,
 *   getById: (id: string) => Promise<Object>,
 *   create: (plan: Object) => Promise<Object>,
 *   update: (id: string, updates: Object) => Promise<Object>,
 *   delete: (id: string) => Promise<void>,
 * }}
 */
export function createTreatmentPlanRepository({
  client,
  getUserId,
  listSelect = DEFAULT_SELECT,
  detailSelect = DEFAULT_SELECT,
  listTransform = identity,
  detailTransform = identity,
}) {
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

    async getById(id) {
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

    async create(plan) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('treatment_plans')
        .insert([{ ...plan, user_id: userId }])
        .select()
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async update(id, updates) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('treatment_plans')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async delete(id) {
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
