// protocolService.js — CRUD mobile de tratamentos (Fase 2 G2: adopt factory).
//
// G2: thin wrapper sobre createProtocolRepository de @dosiq/core/repositories.
// DI mobile: nativeSupabaseClient + getUserId via supabase.auth.
// detailSelect customizado pra trazer treatment_plan completo (ProtocolDetailScreen
// renderiza emoji/name/etc; default da factory traz só medicine).

import { createProtocolRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

const MOBILE_DETAIL_SELECT = `
  *,
  medicine:medicines(*),
  treatment_plan:treatment_plans(*)
`

export const protocolService = createProtocolRepository({
  client: supabase,
  getUserId,
  detailSelect: MOBILE_DETAIL_SELECT,
})
