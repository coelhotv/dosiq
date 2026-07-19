// medicineService.js — CRUD mobile via factory canônica @dosiq/core (Fase 1 G2 mobile).
//
// Preset mobile:
// - listSelect: protocols(id) para badge "X tratamentos associados" na lista
// - detailSelect: stock/purchases/protocols(*) para tela de detalhe
// - Sem transforms — avg_price é responsabilidade do consumer no mobile

import { createMedicineRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

// TODO(040-strict): apps/mobile pina @supabase/supabase-js 2.91.0 vs ^2.90.1 na
// factory do core — tipos nominais do client divergem entre versões (private
// 'supabaseUrl' não bate estruturalmente). Fix real = alinhar versão (fora do lote).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const typedClient = supabase as any

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

export const medicineService = createMedicineRepository({
  client: typedClient,
  getUserId,
  listSelect: `
    *,
    protocols(id)
  `,
  // 029 F5 (T026 / §7.3): `titration_steps` entra no detalhe para o PRECHECK de exclusão.
  // Uma etapa FUTURA de medicine_switch tem `protocol_id` NULL e pode não ter estoque — o
  // medicamento passava no precheck (que só olhava protocols+stock) e a exclusão ia bater no
  // FK `titration_steps_medicine_id_fkey` (sem ON DELETE ⇒ RESTRICT), devolvendo 23503 cru.
  // R-295 — gate de saída EXECUTADO (2026-07-18, service role): HTTP 200, chave `titration_steps`
  // presente na resposta.
  detailSelect: `
    *,
    stock(*),
    purchases(*),
    protocols(*),
    titration_steps(id, position, status, titration_id, protocol_id)
  `,
})
