// createSupplyRunwayRepository.ts — leituras que o app precisa para o predicado e a data de compra
// da spec 105 (`isStockRunwayAlertExpected` / `computeSupplyDate`, `utils/stockRunway.ts`).
//
// Fatia B (R-231): web e mobile injetam `{client, getUserId}`; o servidor tem a sua própria varredura
// em lote (`server/bot/reminders/{stockAlerts,supplyPlan}.ts`) com as MESMAS colunas.
// R-295: colunas verificadas no banco na Fatia A (analysis-A C-1/C-2); o select deste arquivo é
// re-executado por curl no C4 da Fatia B.
// AP-186: toda leitura pagina por `.range` até a página vir incompleta.
// Só LEITURA — nenhum escritor novo.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import type { RunwayInstance, RunwayStep } from '../utils/stockRunway'

export const SUPPLY_STEP_SELECT =
  'id, titration_id, position, medicine_id, status, protocol_id, dose, intake_unit, started_at, duration_days'
export const SUPPLY_MEDICINE_SELECT = 'id, name, dosage_per_pill, dosage_unit, concentration_volume_ml'
export const SUPPLY_INSTANCE_SELECT = 'id, protocol_id, medicine_id, scheduled_for, expected_dose, status'

const PAGE_SIZE = 1000

interface CreateSupplyRunwayRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
}

type PageQuery = (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>

async function fetchAllPages<T>(page: PageQuery): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return out
}

export function createSupplyRunwayRepository({ client, getUserId }: CreateSupplyRunwayRepositoryDeps) {
  if (!client) throw new Error('createSupplyRunwayRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createSupplyRunwayRepository: getUserId deve ser função async')
  }

  return {
    /** Todas as etapas de escada do usuário (o vínculo etapa↔protocolo é `protocol_id`; a seguinte, `titration_id`+`position`). */
    async getSteps(): Promise<RunwayStep[]> {
      const userId = await getUserId()
      return fetchAllPages<RunwayStep>((from, to) =>
        client
          .from('titration_steps')
          .select(SUPPLY_STEP_SELECT)
          .eq('user_id', userId)
          .order('id', { ascending: true })
          .range(from, to),
      )
    },

    /**
     * Doses pendentes a partir de `fromIso`, só dos medicamentos pedidos (lista vazia ⇒ nada a ler).
     * `fromIso` deve recuar 1 dia: o core descarta o que for de antes de hoje local.
     */
    async getPendingInstances(medicineIds: string[], fromIso: string): Promise<RunwayInstance[]> {
      if (!Array.isArray(medicineIds) || medicineIds.length === 0) return []
      const userId = await getUserId()
      return fetchAllPages<RunwayInstance>((from, to) =>
        client
          .from('dose_instances')
          .select(SUPPLY_INSTANCE_SELECT)
          .eq('user_id', userId)
          .eq('status', 'pending')
          .in('medicine_id', medicineIds)
          .gte('scheduled_for', fromIso)
          .order('scheduled_for', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      )
    },

    /** Protocolo de origem do aviso (RLS: de outro usuário ⇒ null). */
    async getProtocolOrigin(protocolId: string): Promise<{ id: string; medicine_id: string } | null> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('protocols')
        .select('id, medicine_id')
        .eq('id', protocolId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return (data as { id: string; medicine_id: string } | null) ?? null
    },

    /**
     * Cadastro mínimo dos medicamentos a comprar que não estão na lista do estoque (escada: o da
     * próxima etapa costuma não ter saldo nem tratamento ativo). Para `formatMedicineFullName` —
     * "Mounjaro" sem a concentração não diz qual caneta comprar.
     */
    async getMedicineSummaries(medicineIds: string[]): Promise<Array<{
      id: string
      name: string | null
      dosage_per_pill: number | null
      dosage_unit: string | null
      concentration_volume_ml: number | null
    }>> {
      if (!Array.isArray(medicineIds) || medicineIds.length === 0) return []
      const userId = await getUserId()
      const { data, error } = await client
        .from('medicines')
        .select(SUPPLY_MEDICINE_SELECT)
        .eq('user_id', userId)
        .in('id', medicineIds)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; name: string | null; dosage_per_pill: number | null; dosage_unit: string | null; concentration_volume_ml: number | null }>
    },

    /** Nome do medicamento (só para o título da tela de estoque; nunca vem do push). */
    async getMedicineName(medicineId: string): Promise<string | null> {
      const userId = await getUserId()
      const { data, error } = await client
        .from('medicines')
        .select('id, name')
        .eq('id', medicineId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return (data as { name?: string | null } | null)?.name ?? null
    },
  }
}

export type SupplyRunwayRepository = ReturnType<typeof createSupplyRunwayRepository>
