// createTitrationRepository.ts — Factory CRUD da escada de titulação (Evolução do tratamento).
//
// Spec 029 / ADR-080 / Slice F2 (T006). Web e mobile injetam `{client, getUserId}`.
// Orquestra `titrations` (escada) + `titration_steps` (etapas). Nível A strict.
//
// ⚠️ AP-293 (denormalização de dono exige coerência): `user_id` das etapas é SEMPRE derivado
// do dono autenticado (`getUserId`), NUNCA aceito do payload. A FK composta
// `titration_steps(titration_id, user_id) → titrations(id, user_id)` rejeita (23503) qualquer
// etapa cujo `user_id` não bata com o da escada-pai. Como escada e etapas usam o mesmo
// `getUserId()` (= dono via RLS), a coerência é estrutural.
//
// ESCOPO F2: CRUD puro. Nenhum motor de avanço, nenhuma transição, nenhuma RPC (F3).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import type { TitrationCreate, TitrationStepCreate } from '../schemas/titrationSchema'

type TitrationRow = Database['public']['Tables']['titrations']['Row']
type TitrationStepRow = Database['public']['Tables']['titration_steps']['Row']

const DEFAULT_TITRATION_SELECT = '*'
const DEFAULT_TITRATION_DETAIL_SELECT = '*, steps:titration_steps(*)'
const DEFAULT_STEP_SELECT = '*'

interface CreateTitrationRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

/** Campos de uma etapa que o servidor controla (não vêm do builder do usuário). */
interface TitrationStepServerFields {
  status?: TitrationStepRow['status']
  protocol_id?: TitrationStepRow['protocol_id']
  started_at?: TitrationStepRow['started_at']
  ended_at?: TitrationStepRow['ended_at']
}

type TitrationStepInsert = TitrationStepCreate & TitrationStepServerFields

/**
 * Cria um repositório CRUD da escada de titulação parametrizado por plataforma.
 */
export function createTitrationRepository({ client, getUserId }: CreateTitrationRepositoryDeps) {
  if (!client) throw new Error('createTitrationRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createTitrationRepository: getUserId deve ser função async')
  }

  return {
    // ── titrations (escada) ──────────────────────────────────────────────
    async getAll(): Promise<TitrationRow[]> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('titrations')
        .select(DEFAULT_TITRATION_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as TitrationRow[]
    },

    /** Escada + etapas aninhadas (ordenadas por position no consumidor, se preciso). */
    async getById(id: string) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('titrations')
        .select(DEFAULT_TITRATION_DETAIL_SELECT)
        .eq('id', id)
        .eq('user_id', userId)
        .order('position', { referencedTable: 'titration_steps', ascending: true })
        .single()

      if (error) throw error
      return data
    },

    async create(input: TitrationCreate): Promise<TitrationRow> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('titrations')
        .insert([{ ...input, user_id: userId }] as never)
        .select()
        .single()

      if (error) throw error
      return data as TitrationRow
    },

    async delete(id: string): Promise<void> {
      // Etapas caem por CASCADE (FK composta). protocol_id em titration_steps é SET NULL.
      const userId = await getUserId()
      const { error } = await client
        .from('titrations')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },

    // ── titration_steps (etapas) ─────────────────────────────────────────
    async getSteps(titrationId: string): Promise<TitrationStepRow[]> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('titration_steps')
        .select(DEFAULT_STEP_SELECT)
        .eq('titration_id', titrationId)
        .eq('user_id', userId)
        .order('position', { ascending: true })

      if (error) throw error
      return (data ?? []) as TitrationStepRow[]
    },

    /**
     * Insere uma etapa. `user_id` é derivado do dono (AP-293) — a FK composta exige que bata
     * com o da escada-pai. `status` default 'upcoming' (mesmo default do banco).
     */
    async createStep(input: TitrationStepInsert): Promise<TitrationStepRow> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('titration_steps')
        .insert([{ ...input, user_id: userId }] as never)
        .select()
        .single()

      if (error) throw error
      return data as TitrationStepRow
    },

    /** Insere várias etapas de uma escada num único INSERT. Todas com o `user_id` do dono. */
    async createSteps(inputs: TitrationStepInsert[]): Promise<TitrationStepRow[]> {
      if (inputs.length === 0) return []
      const userId = await getUserId()
      const rows = inputs.map((s) => ({ ...s, user_id: userId }))
      const { data, error } = await client
        .from('titration_steps')
        .insert(rows as never)
        .select()

      if (error) throw error
      return (data ?? []) as TitrationStepRow[]
    },

    /**
     * Atualiza uma etapa. `expectedStatuses` (opcional) é um CLAIM atômico: filtra o UPDATE por
     * `status IN (...)`, então a linha só muda se ainda estiver num desses estados. Serve o guard
     * A4 (plan §A4:247): a edição client-side só pode tocar etapas futuras — se o cron avançou a
     * etapa (upcoming→current) entre o load e o save, o claim volta vazio e retorna `null` em vez de
     * clobberar uma etapa já vigente (reabriria a classe zumbi — AP-301). Sem o guard: comportamento
     * de sempre (só id+user_id).
     */
    async updateStep(
      id: string,
      updates: Partial<Omit<TitrationStepRow, 'id' | 'user_id' | 'titration_id'>>,
      expectedStatuses?: TitrationStepRow['status'][],
    ): Promise<TitrationStepRow | null> {
      const userId = await getUserId()
      let query = client
        .from('titration_steps')
        .update(updates as never)
        .eq('id', id)
        .eq('user_id', userId)
      if (expectedStatuses && expectedStatuses.length > 0) {
        query = query.in('status', expectedStatuses as never)
      }
      const { data, error } = await query.select().maybeSingle()

      if (error) throw error
      return (data ?? null) as TitrationStepRow | null
    },

    /**
     * Remove uma etapa. `expectedStatuses` (opcional) = claim atômico (ver `updateStep`): retorna
     * `false` se nenhuma linha casou (a etapa avançou sob a edição — guard A4). Sem o guard: apaga
     * por id+user_id e retorna `true`.
     */
    async deleteStep(id: string, expectedStatuses?: TitrationStepRow['status'][]): Promise<boolean> {
      const userId = await getUserId()
      let query = client
        .from('titration_steps')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (expectedStatuses && expectedStatuses.length > 0) {
        query = query.in('status', expectedStatuses as never)
      }
      const { data, error } = await query.select('id')

      if (error) throw error
      return Array.isArray(data) && data.length > 0
    },
  }
}
