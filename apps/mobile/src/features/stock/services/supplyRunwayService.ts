// supplyRunwayService — leituras da spec 105 (Fatia B) para o app: etapas de escada e doses pendentes
// dos medicamentos elegíveis. Casca fina sobre o repositório do core (R-231): a mesma factory serve a
// web; aqui só entra o cliente nativo.

import { createSupplyRunwayRepository } from '@dosiq/core'
import { supabase as nativeSupabaseClient } from '../../../platform/supabase/nativeSupabaseClient'

async function getUserId() {
  const { data, error } = await nativeSupabaseClient.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

// TODO(040-strict): versão do supabase-js do mobile difere da do core (ver stockService.ts).
export const supplyRunwayService = createSupplyRunwayRepository({
  client: nativeSupabaseClient as any,
  getUserId,
})
