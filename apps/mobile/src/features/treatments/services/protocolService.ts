// protocolService.js — CRUD mobile de tratamentos (Fase 2 G2: adopt factory).
//
// G2: thin wrapper sobre createProtocolRepository de @dosiq/core/repositories.
// DI mobile: nativeSupabaseClient + getUserId via supabase.auth.
// detailSelect customizado pra trazer treatment_plan completo (ProtocolDetailScreen
// renderiza emoji/name/etc; default da factory traz só medicine).

import { createProtocolRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

// TODO(040-strict): apps/mobile pina @supabase/supabase-js 2.91.0 vs ^2.90.1 na
// root — duplicata de instalação quebra nominal typing do client (protected member
// 'supabaseUrl' não bate estruturalmente). Fix real = alinhar versão (fora do lote).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const typedClient = supabase as any

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

// titration_steps embed (029 F4): alimenta o badge "Em evolução"/"Estável" derivado da escada N2
// (getEvolutionBadge) — a coluna N1 titration_status está deprecada. Filtra por protocol_id (FK).
// R-295: `status`/`duration_days` verificadas no banco (information_schema); embed via FK
// `titration_steps.protocol_id → protocols.id`; select executado contra o PostgREST (401 auth,
// não 42703/PGRST200 — shape válido).
const MOBILE_DETAIL_SELECT = `
  *,
  medicine:medicines(*),
  treatment_plan:treatment_plans(*),
  titration_steps(status, duration_days)
`

export const protocolService = createProtocolRepository({
  client: typedClient,
  getUserId,
  detailSelect: MOBILE_DETAIL_SELECT,
})
