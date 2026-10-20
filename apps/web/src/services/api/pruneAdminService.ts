// apps/web/src/services/api/pruneAdminService.ts
// Admin Service — fila de exclusão com aprovação manual (spec 107 / ADR-111).
//
// Endpoint único /api/admin?resource=prune&action=… (R-090 — sem função serverless nova). Toda trava
// (queue_id + prefixo, janela de 7 dias, gate 0.34 do legado, conjunto da onda 2) mora no HANDLER;
// este service só repassa a resposta. O e-mail inteiro NUNCA vem no list — só por `reveal`, 1 linha.

import { supabase } from '@shared/utils/supabase'

const BASE = '/api/admin?resource=prune'

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Não autenticado.')
  return { Authorization: `Bearer ${token}` }
}

type CallInit = { method?: 'GET' | 'POST' | 'PUT'; body?: string }

async function call(action: string, init: CallInit = {}) {
  const headers = { ...(await authHeader()), ...(init.body ? { 'Content-Type': 'application/json' } : {}) }
  const response = await fetch(`${BASE}&action=${action}`, { ...init, headers })
  const body = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
  if (!response.ok) {
    if (response.status === 401) throw new Error('Não autorizado.')
    throw new Error(body.error || 'Falha na operação')
  }
  return body
}

const post = (action: string, payload: object) => call(action, { method: 'POST', body: JSON.stringify(payload) })

export const pruneAdminService = {
  list(tab: 'pending' | 'history' = 'pending') {
    return call(`list&tab=${tab}`)
  },
  approve(queueId: string, prefix: string) {
    return post('approve', { queue_id: queueId, prefix })
  },
  defer(queueId: string, note: string, reevaluateAt: string) {
    return post('defer', { queue_id: queueId, note, reevaluate_at: reevaluateAt })
  },
  /** `milestone` vai para a auditoria: por que o e-mail foi revelado. */
  reveal(target: { queueId?: string; userId?: string }, milestone: 'd60' | 'd83' | 'wave2') {
    return post('reveal', { queue_id: target.queueId, user_id: target.userId, milestone })
  },
  markNotice(target: { queueId?: string; userId?: string }, milestone: 'd60' | 'd83' | 'wave2') {
    return post('mark_notice', { queue_id: target.queueId, user_id: target.userId, milestone })
  },
  getTexts() {
    return call('texts')
  },
  updateTexts(body: string) {
    return call('texts', { method: 'PUT', body: JSON.stringify({ body }) })
  },
}

export default pruneAdminService
