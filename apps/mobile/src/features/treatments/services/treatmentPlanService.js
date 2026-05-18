// treatmentPlanService.js — CRUD mobile de planos terapêuticos (Fase 2 G2).
//
// G2: thin wrapper sobre createTreatmentPlanRepository de @dosiq/core/repositories.
// DI mobile: nativeSupabaseClient + getUserId via supabase.auth.

import { createTreatmentPlanRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

export const treatmentPlanService = createTreatmentPlanRepository({
  client: supabase,
  getUserId,
})
