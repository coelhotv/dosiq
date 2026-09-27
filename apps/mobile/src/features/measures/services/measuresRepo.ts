// measuresRepo.js — instância do repositório de biomarcadores ligada ao client nativo.
// 012 Fase C · ADR-060. Reusa a factory canônica do @dosiq/core (R-231).

import { createBiomarkerRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { logEvent } from '../../../platform/analytics/productAnalytics'
import { EVENTS } from '../../../platform/analytics/analyticsEvents'

async function getUserId() {
  const session = await supabase.auth.getSession()
  const userId = session?.data?.session?.user?.id
  if (!userId) throw new Error('Usuário não autenticado')
  return userId
}

// TODO(040-strict): supabase client local não tipado como Database (nível B)
const repo = createBiomarkerRepository({ client: supabase as any, getUserId })

// ── Casca de analytics (spec 065 PR D / FR-13 · mesma forma do medicineService) ─────────────────
// Três telas criam biomarcador (useMeasures, TodayScreen, HistoryScreen — C1.5 G-1): o evento nasce
// aqui para nenhuma escapar. Só depois do sucesso, com o tipo da LINHA GRAVADA.
// 🔴 FR-8/R-042: nunca value/value_secondary/notes — dado clínico.
export const measuresRepo = {
  ...repo,
  async create(biomarker) {
    const created = await repo.create(biomarker)
    void logEvent(EVENTS.BIOMARKER_LOGGED, { biomarker_type: created?.type ?? biomarker?.type })
    return created
  },
}
