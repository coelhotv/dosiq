// apps/web/src/services/api/growthAdminService.ts
// Admin Service — painel de crescimento e wedge (spec 115).
//
// Endpoint único /api/admin?resource=growth (R-090 — sem função serverless nova). Só leitura: o
// servidor consolida tudo numa RPC e devolve sem nome comercial de medicamento (INV-2).

import { supabase } from '@shared/utils/supabase'

const BASE = '/api/admin?resource=growth'

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Não autenticado.')
  return { Authorization: `Bearer ${token}` }
}

export const growthAdminService = {
  async load({ limit = 500, offset = 0 }: { limit?: number; offset?: number } = {}) {
    const response = await fetch(`${BASE}&limit=${limit}&offset=${offset}`, { headers: await authHeader() })
    const body = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
    if (!response.ok) {
      if (response.status === 401) throw new Error('Não autorizado.')
      throw new Error(body.error || 'Falha ao carregar analytics')
    }
    return body
  },
}

export default growthAdminService
