// medicineService.js — CRUD mobile via factory canônica @dosiq/core (Fase 1 G2 mobile).
//
// Preset mobile:
// - listSelect: protocols(id) para badge "X tratamentos associados" na lista
// - detailSelect: stock/purchases/protocols(*) para tela de detalhe
// - Sem transforms — avg_price é responsabilidade do consumer no mobile

import { createMedicineRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

export const medicineService = createMedicineRepository({
  client: supabase,
  getUserId,
  listSelect: `
    *,
    protocols(id)
  `,
  detailSelect: `
    *,
    stock(*),
    purchases(*),
    protocols(*)
  `,
})
