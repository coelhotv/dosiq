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

// TODO(040-strict): apps/mobile pina @supabase/supabase-js 2.91.0 vs ^2.90.1 na
// root — duplicata de instalação quebra nominal typing do client (protected member
// 'supabaseUrl' não bate estruturalmente). Fix real = alinhar versão (fora do lote).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const typedClient = supabase as any

export const treatmentPlanService = createTreatmentPlanRepository({
  client: typedClient,
  getUserId,
})
