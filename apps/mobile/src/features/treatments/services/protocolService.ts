// protocolService.js — CRUD mobile de tratamentos (Fase 2 G2: adopt factory).
//
// G2: thin wrapper sobre createProtocolRepository de @dosiq/core/repositories.
// DI mobile: nativeSupabaseClient + getUserId via supabase.auth.
// detailSelect customizado pra trazer treatment_plan completo (ProtocolDetailScreen
// renderiza emoji/name/etc; default da factory traz só medicine).

import { createProtocolRepository } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { logEvent } from '../../../platform/analytics/productAnalytics'
import { EVENTS } from '../../../platform/analytics/analyticsEvents'

// TODO(040-strict): apps/mobile pina @supabase/supabase-js 2.91.0 vs ^2.90.1 na
// root — duplicata de instalação quebra nominal typing do client (protected member
// 'supabaseUrl' não bate estruturalmente). Fix real = alinhar versão (fora do lote).
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

const repo = createProtocolRepository({
  client: typedClient,
  getUserId,
  detailSelect: MOBILE_DETAIL_SELECT,
})

// ── Casca de analytics (spec 065 PR B / TC-3 · ADR-071) ─────────────────────────────────────────
// O repositório do core fica intocado (zero linha em packages/core): esta casca delega e, SÓ depois
// do sucesso, emite a transição. Todo escritor de `protocols` no mobile passa por aqui (C1.5 do PR B:
// form, onboarding, toggle e exclusão), então nenhuma tela emite evento de tratamento.
//
// 🔴 SEM DEFAULT de `surface` (plan.md A-1): chamador que não informa manda o evento sem a chave.
// 🔴 Pausa ≠ encerramento (CON-034): `active` true→false é `treatment_paused`; exclusão é
//    `treatment_ended{reason:'deleted'}`; `prescription_end` é DERIVADO de `treatment_planned_end`,
//    nunca emitido aqui.
// 🔴 Props saem da LINHA devolvida pela escrita (o fato persistido), não do payload (R-299).

// Grupos de `change_kind` (TRACKING_PLAN §5.3) — o valor alterado NUNCA entra no evento (§6).
// 🔴 TODO campo editável do form cai em algum grupo (teste de completude contra
// `buildInitialValues`): o smoke do PR B achou `critical_alarm` fora dos grupos, e desligar o
// alerta crítico não emitia nada (AP-315 — inventário pelo contrato, não pelo form real).
// `active` fica de fora de propósito: é pausa/retomada, evento próprio.
// `titration` não é campo do form: vem do fluxo da escada (`emitTitrationEdited`).
export const CHANGE_GROUPS = {
  dose: ['dosage_per_intake', 'intake_unit', 'medicine_id'],
  schedule: ['time_schedule', 'weekdays'],
  frequency: ['frequency', 'interval_days'],
  dates: ['start_date', 'end_date'],
  alarm: ['critical_alarm'],
  plan: ['treatment_plan_id'],
  details: ['name', 'notes'],
}

// Form manda número como string às vezes ('1' vs 1): compara pela forma serializada.
function sameValue(a, b) {
  const norm = (v) => (Array.isArray(v) ? JSON.stringify(v.map(String)) : v == null || v === '' ? '' : String(v))
  return norm(a) === norm(b)
}

/**
 * Quais grupos uma edição mexeu. Sem `previous` (não deveria acontecer no form), conta os grupos
 * cujas chaves vieram no payload — melhor que omitir a edição.
 */
export function buildChangeKinds(previous, updates) {
  return Object.entries(CHANGE_GROUPS)
    .filter(([, keys]) =>
      keys.some((k) => k in updates && (previous == null || !sameValue(previous[k], updates[k])))
    )
    .map(([kind]) => kind)
}

// Chave com valor ausente fica FORA do payload (mesmo princípio do `_doseEventProps` do PR A).
function compact(props) {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v != null))
}

function baseProps(row, surface) {
  return { surface, treatment_id: row?.id, medicine_id: row?.medicine_id }
}

// `treatment_plan_id` (UUID opaco, R-042) em created/edited: segmenta quem agrupa tratamentos em
// plano — hipótese do PO de que é o perfil com vários tratamentos e mais engajado.
function writeProps(row) {
  return {
    frequency: row?.frequency,
    interval_days: row?.interval_days,
    treatment_plan_id: row?.treatment_plan_id,
    // Re-emitida na edição: o valor novo supersede o anterior (TRACKING_PLAN §5.3.1).
    treatment_planned_end: row?.end_date,
  }
}

/**
 * Cadastro/edição da escada de titulação (escreve em `titration_steps`, fora do `update()` do
 * protocolo) é edição do tratamento: `treatment_edited{change_kind:['titration']}`.
 */
export async function emitTitrationEdited({ treatmentId, medicineId = null, surface = null }) {
  await logEvent(
    EVENTS.TREATMENT_EDITED,
    compact({ surface, treatment_id: treatmentId, medicine_id: medicineId, change_kind: ['titration'] })
  )
}

export const protocolService = {
  ...repo,

  async create(protocol, { surface = null, entryPoint = null } = {}) {
    const row = await repo.create(protocol)
    await logEvent(
      EVENTS.TREATMENT_CREATED,
      compact({
        ...baseProps(row, surface),
        entry_point: entryPoint,
        // No mobile a escada nasce DEPOIS do protocolo (createFullLadder) → false na criação.
        is_titration: Array.isArray(row?.titration_steps) && row.titration_steps.length > 0,
        ...writeProps(row),
      })
    )
    return row
  },

  async update(id, updates, { surface = null, previous = null } = {}) {
    const row = await repo.update(id, updates)
    const activeChanged = 'active' in updates && (previous == null || previous.active !== updates.active)
    if (activeChanged) {
      await logEvent(
        row?.active ? EVENTS.TREATMENT_RESUMED : EVENTS.TREATMENT_PAUSED,
        compact(baseProps(row, surface))
      )
    }
    const changeKind = buildChangeKinds(previous, updates)
    if (changeKind.length > 0) {
      await logEvent(
        EVENTS.TREATMENT_EDITED,
        compact({
          ...baseProps(row, surface),
          change_kind: changeKind,
          ...writeProps(row),
        })
      )
    }
    return row
  },

  async delete(id, { surface = null, medicineId = null } = {}) {
    const result = await repo.delete(id)
    await logEvent(
      EVENTS.TREATMENT_ENDED,
      compact({ surface, treatment_id: id, medicine_id: medicineId, reason: 'deleted' })
    )
    return result
  },
}
