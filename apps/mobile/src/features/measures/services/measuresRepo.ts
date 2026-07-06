// measuresRepo.js — instância do repositório de biomarcadores ligada ao client nativo.
// 012 Fase C · ADR-060. Reusa a factory canônica do @dosiq/core (R-231).

import { createBiomarkerRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

async function getUserId() {
  const session = await supabase.auth.getSession()
  const userId = session?.data?.session?.user?.id
  if (!userId) throw new Error('Usuário não autenticado')
  return userId
}

// TODO(040-strict): supabase client local não tipado como Database (nível B)
export const measuresRepo = createBiomarkerRepository({ client: supabase as any, getUserId })
