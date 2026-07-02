// packages/core/src/services/criticalAuditService.js
// Serviço de emissão de eventos de auditoria para dose crítica (042 Slice A).
//
// FAIL-OPEN por design: este serviço registra evidência (log de auditoria), mas nunca
// pode ser a causa de uma falha no fluxo dono (alarme/registro de dose/push). Qualquer
// erro — validação, rede, RLS — é capturado e vira `{ ok:false }`; nada é lançado.
//
// Regra do userId (SEC-2): no mobile/web, `getUserId` resolve o usuário logado.
// No SERVER (ex.: worker de push/scheduler), não há sessão — não existe `getUserId`.
// Nesse caso o CALLER deve derivar o userId a partir da dose_instance (join) e passar
// explicitamente em `evt.userId`. Se nenhum dos dois estiver disponível, o evento seria
// órfão (sem dono) — isso é proibido: não inserimos e retornamos `{ ok:false }` sem lançar.

import { criticalAuditEventSchema } from '../schemas/criticalAuditEventSchema.js'

/** Resolve o user_id do evento: evt.userId explícito (cenário server) tem prioridade;
 *  senão usa getUserId() quando disponível; senão null (evento órfão — não insere). */
async function resolveUserId(evt, getUserId) {
  if (evt.userId) return evt.userId
  if (typeof getUserId === 'function') {
    const id = await getUserId()
    return id ?? null
  }
  return null
}

/**
 * Factory do serviço de auditoria de eventos críticos.
 *
 * @param {Object} deps
 * @param {Object} deps.client - Cliente Supabase.
 * @param {Function} [deps.getUserId] - Função async () => string. Ausente no server
 *   (worker/scheduler sem sessão) — nesse caso `evt.userId` é obrigatório.
 */
export function createCriticalAuditService({ client, getUserId } = {}) {
  /**
   * Emite (persiste) um evento de auditoria. Fail-open: nunca lança.
   * @param {Object} evt - { doseInstanceId?, event, platform, actor, detail?, userId? }
   * @returns {Promise<{ok: boolean}>}
   */
  async function emit(evt) {
    try {
      const userId = await resolveUserId(evt, getUserId)
      if (!userId) {
        // Evento órfão — não há dono pra atribuir. Não insere, não lança.
        return { ok: false }
      }

      const payload = {
        userId,
        doseInstanceId: evt.doseInstanceId ?? null,
        event: evt.event,
        platform: evt.platform,
        actor: evt.actor,
        detail: evt.detail ?? null,
      }

      const validation = criticalAuditEventSchema.safeParse(payload)
      if (!validation.success) {
        return { ok: false }
      }

      const d = validation.data
      const { error } = await client.from('dose_critical_events').insert({
        user_id: d.userId,
        dose_instance_id: d.doseInstanceId ?? null,
        event: d.event,
        platform: d.platform,
        actor: d.actor,
        detail: d.detail ?? null,
      })

      if (error) return { ok: false }
      return { ok: true }
    } catch {
      // Rede, RLS, throw do mock, etc. — nunca propaga.
      return { ok: false }
    }
  }

  return { emit }
}

export default createCriticalAuditService
