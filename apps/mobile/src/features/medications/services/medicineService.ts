// medicineService.js — CRUD mobile via factory canônica @dosiq/core (Fase 1 G2 mobile).
//
// Preset mobile:
// - listSelect: protocols(id) para badge "X tratamentos associados" na lista
// - detailSelect: stock/purchases/protocols(*) para tela de detalhe
// - Sem transforms — avg_price é responsabilidade do consumer no mobile

import { createMedicineRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { logEvent } from '../../../platform/analytics/productAnalytics'
import { EVENTS } from '../../../platform/analytics/analyticsEvents'

// TODO(040-strict): apps/mobile pina @supabase/supabase-js 2.91.0 vs ^2.90.1 na
// factory do core — tipos nominais do client divergem entre versões (private
// 'supabaseUrl' não bate estruturalmente). Fix real = alinhar versão (fora do lote).
const typedClient = supabase as any

async function getUserId() {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

const repo = createMedicineRepository({
  client: typedClient,
  getUserId,
  listSelect: `
    *,
    protocols(id)
  `,
  // 029 F5 (T026 / §7.3): `titration_steps` entra no detalhe para o PRECHECK de exclusão.
  // Uma etapa FUTURA de medicine_switch tem `protocol_id` NULL e pode não ter estoque — o
  // medicamento passava no precheck (que só olhava protocols+stock) e a exclusão ia bater no
  // FK `titration_steps_medicine_id_fkey` (sem ON DELETE ⇒ RESTRICT), devolvendo 23503 cru.
  // R-295 — gate de saída EXECUTADO (2026-07-18, service role): HTTP 200, chave `titration_steps`
  // presente na resposta.
  detailSelect: `
    *,
    stock(*),
    purchases(*),
    protocols(*),
    titration_steps(id, position, status, titration_id, protocol_id)
  `,
})

// ── Casca de analytics (spec 065 PR C2 / TC-3 · mesma forma do protocolService) ─────────────────
// O repositório do core fica intocado: a casca delega e, SÓ depois do sucesso, emite. Todo escritor
// de `medicines` no mobile passa por aqui (C1.5 do C2: form, exclusão, onboarding e o `units_per_ml`
// do form de tratamento) — tela nenhuma emite evento de medicamento.
//
// 🔴 SEM DEFAULT de `surface` (plan.md A-1): chamador que não informa manda o evento sem a chave.
// 🔴 Nunca o nome do medicamento (R-042): só o UUID.

// Chave com valor ausente fica FORA do payload (mesmo princípio do `_doseEventProps`).
function compact(props) {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v != null))
}

export const medicineService = {
  ...repo,

  async create(medicine, { surface = null } = {}) {
    const row = await repo.create(medicine)
    await logEvent(EVENTS.MEDICINE_ADDED, compact({ surface, medicine_id: row?.id }))
    return row
  },

  async update(id, updates, { surface = null } = {}) {
    const row = await repo.update(id, updates)
    await logEvent(EVENTS.MEDICINE_EDITED, compact({ surface, medicine_id: row?.id ?? id }))
    return row
  },

  // A linha deixa de existir: o id é o do argumento (o que foi apagado).
  async delete(id, { surface = null } = {}) {
    const result = await repo.delete(id)
    await logEvent(EVENTS.MEDICINE_DELETED, compact({ surface, medicine_id: id }))
    return result
  },
}
