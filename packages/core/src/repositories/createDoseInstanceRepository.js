// createDoseInstanceRepository.js — Factory de acesso a dose_instances (ADR-048, Fase 2).
//
// Espelha o pattern de createProtocolRepository. Web/mobile/server injetam o client
// Supabase. Diferente dos repos CRUD de UI, os métodos escopam por `protocol_id`
// (posse garantida pelo dono do protocolo) ou por `userId` explícito (getWindow) —
// o motor de geração roda como service_role e itera múltiplos usuários, então não
// depende de getUserId de sessão. RLS (user_id = auth.uid()) cobre o acesso client.
//
// Métodos:
// - upsertMany(instances)            → INSERT ... ON CONFLICT (protocol_id, scheduled_for) DO NOTHING (idempotente)
// - wipeFuturePending(protocolId)    → DELETE status='pending' AND scheduled_for > now() (nunca toca passado/taken/missed)
// - getWindow(userId, fromTs, toTs)  → instâncias do usuário na janela, ordenadas
// - getGeneratedThrough(protocolId)  → high-water-mark (protocols.generated_through)
// - setGeneratedThrough(protocolId, ts)
// - markSkippedPaused(protocolId, untilTs) → pendentes futuras até untilTs viram skipped_paused

import { getServerTimestamp, parseISO, parseTimestamp } from '../utils/dateUtils.js'

const TABLE = 'dose_instances'
const PROTOCOLS = 'protocols'

/** Teto de tolerância (min) — janela de busca grosseira no snap; filtro fino usa o
 *  `tolerance_minutes` de cada linha. Casa com o default/cap da migration (§6 MASTER_PLAN). */
const MAX_TOLERANCE_MINUTES = 120
const MS_PER_MINUTE = 60 * 1000

/** Converte Date|ISO em ISO string (R-020: sem `new Date()` fora de dateUtils). */
const toIso = (value) => parseISO(value).toISOString()

/**
 * @param {Object} deps
 * @param {Object} deps.client - Cliente Supabase.
 */
export function createDoseInstanceRepository({ client }) {
  if (!client) throw new Error('createDoseInstanceRepository: client é obrigatório')

  return {
    /**
     * Insere instâncias ignorando conflitos no índice único (protocol_id, scheduled_for).
     * Idempotente: rodar 2x não duplica nem sobrescreve instâncias já materializadas.
     * @param {Array<Object>} instances - linhas prontas (user_id, protocol_id, scheduled_for, expected_dose, tolerance_minutes)
     * @returns {Promise<Array>} linhas efetivamente inseridas
     */
    async upsertMany(instances) {
      if (!Array.isArray(instances) || instances.length === 0) return []
      const { data, error } = await client
        .from(TABLE)
        .upsert(instances, {
          onConflict: 'protocol_id,scheduled_for',
          ignoreDuplicates: true,
        })
        .select()

      if (error) throw error
      return data ?? []
    },

    /**
     * Remove APENAS instâncias pendentes futuras de um protocolo.
     * Regra inviolável (§4 MASTER_PLAN): nunca toca taken/missed/skipped nem o passado.
     * @param {string} protocolId
     * @returns {Promise<void>}
     */
    async wipeFuturePending(protocolId) {
      const { error } = await client
        .from(TABLE)
        .delete()
        .eq('protocol_id', protocolId)
        .eq('status', 'pending')
        .gt('scheduled_for', getServerTimestamp())

      if (error) throw error
    },

    /**
     * Versão em lote de wipeFuturePending: remove pendentes futuras de VÁRIOS protocolos
     * num único DELETE (evita N+1 no cron). Mesma regra inviolável: só pending + futuro.
     * @param {string[]} protocolIds
     * @returns {Promise<void>}
     */
    async wipeFuturePendingForProtocols(protocolIds) {
      if (!Array.isArray(protocolIds) || protocolIds.length === 0) return
      const { error } = await client
        .from(TABLE)
        .delete()
        .in('protocol_id', protocolIds)
        .eq('status', 'pending')
        .gt('scheduled_for', getServerTimestamp())

      if (error) throw error
    },

    /**
     * Instâncias de um usuário dentro de [fromTs, toTs], ordenadas por scheduled_for.
     * @param {string} userId
     * @param {Date|string} fromTs
     * @param {Date|string} toTs
     * @returns {Promise<Array>}
     */
    async getWindow(userId, fromTs, toTs) {
      const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_for', toIso(fromTs))
        .lte('scheduled_for', toIso(toTs))
        .order('scheduled_for', { ascending: true })

      if (error) throw error
      return data ?? []
    },

    /**
     * High-water-mark de geração do protocolo.
     * @param {string} protocolId
     * @returns {Promise<string|null>} ISO timestamptz ou null
     */
    async getGeneratedThrough(protocolId) {
      const { data, error } = await client
        .from(PROTOCOLS)
        .select('generated_through')
        .eq('id', protocolId)
        .single()

      if (error) throw error
      return data?.generated_through ?? null
    },

    /**
     * Atualiza o high-water-mark de geração.
     * @param {string} protocolId
     * @param {Date|string} ts
     * @returns {Promise<void>}
     */
    async setGeneratedThrough(protocolId, ts) {
      const { error } = await client
        .from(PROTOCOLS)
        .update({ generated_through: toIso(ts) })
        .eq('id', protocolId)

      if (error) throw error
    },

    /**
     * Grava (ou limpa) o timestamp de pausa do protocolo.
     * @param {string} protocolId
     * @param {Date|string|null} ts - null limpa a marca (resume)
     * @returns {Promise<void>}
     */
    async setPausedAt(protocolId, ts) {
      const { error } = await client
        .from(PROTOCOLS)
        .update({ paused_at: ts === null ? null : toIso(ts) })
        .eq('id', protocolId)

      if (error) throw error
    },

    /**
     * Reativa instâncias futuras que estavam pausadas (skipped_paused → pending).
     * Usado ao religar um protocolo: o upsert idempotente (ON CONFLICT DO NOTHING) não
     * reverteria essas linhas, então a reativação é explícita. Nunca toca o passado.
     * @param {string} protocolId
     * @returns {Promise<void>}
     */
    async reactivateFuturePaused(protocolId) {
      const { error } = await client
        .from(TABLE)
        .update({ status: 'pending' })
        .eq('protocol_id', protocolId)
        .eq('status', 'skipped_paused')
        .gt('scheduled_for', getServerTimestamp())

      if (error) throw error
    },

    /**
     * Marca instâncias pendentes futuras até `untilTs` como skipped_paused (pausa não penaliza).
     * @param {string} protocolId
     * @param {Date|string} untilTs
     * @returns {Promise<void>}
     */
    async markSkippedPaused(protocolId, untilTs) {
      const { error } = await client
        .from(TABLE)
        .update({ status: 'skipped_paused' })
        .eq('protocol_id', protocolId)
        .eq('status', 'pending')
        .gt('scheduled_for', getServerTimestamp())
        .lte('scheduled_for', toIso(untilTs))

      if (error) throw error
    },

    /**
     * Snap: acha a instância PENDENTE a ancorar para uma tomada em `takenAt`.
     * Escopa SEMPRE por `protocolId` (nunca por medicine_id — AP-A03: logs vazam
     * entre protocolos do mesmo medicamento). Respeita a tolerância de CADA linha
     * (`tolerance_minutes`, que varia por slot) e devolve a instância mais próxima
     * de `takenAt`. Fora de toda janela → null (dose avulsa).
     *
     * A janela do SELECT usa o teto (120min); o filtro fino por linha é em JS,
     * pois cada instância tem sua própria tolerância. Só `pending` é elegível —
     * nunca re-ancora taken/missed/skipped.
     *
     * @param {Object} args
     * @param {string} args.protocolId
     * @param {Date|string} args.takenAt
     * @returns {Promise<{id: string, scheduled_for: string, tolerance_minutes: number}|null>}
     */
    async findAnchorInstance({ protocolId, takenAt }) {
      if (!protocolId) return null
      const takenMs = parseISO(takenAt).getTime()
      const lowIso = parseTimestamp(takenMs - MAX_TOLERANCE_MINUTES * MS_PER_MINUTE).toISOString()
      const highIso = parseTimestamp(takenMs + MAX_TOLERANCE_MINUTES * MS_PER_MINUTE).toISOString()

      const { data, error } = await client
        .from(TABLE)
        .select('id, scheduled_for, tolerance_minutes')
        .eq('protocol_id', protocolId)
        .eq('status', 'pending')
        .gte('scheduled_for', lowIso)
        .lte('scheduled_for', highIso)

      if (error) throw error
      if (!data || data.length === 0) return null

      // Filtro fino: dentro da tolerância da própria linha; pega a mais próxima.
      let best = null
      let bestDiff = Infinity
      for (const inst of data) {
        const diff = Math.abs(parseISO(inst.scheduled_for).getTime() - takenMs)
        const tol = (inst.tolerance_minutes ?? MAX_TOLERANCE_MINUTES) * MS_PER_MINUTE
        if (diff <= tol && diff < bestDiff) {
          best = inst
          bestDiff = diff
        }
      }
      return best
    },

    /**
     * Liga instância ↔ log: marca a ocorrência como `taken` e grava o `medicine_log_id`.
     * FP-1 (ADR-050): NÃO compara `quantity_taken` com `expected_dose` — a dose aplicada
     * pode divergir da planejada (bolus variável futuro). Só ancora se ainda `pending`
     * (guard contra corrida/dupla-tomada). Idempotente por instância.
     * @param {string} instanceId
     * @param {string} medicineLogId
     * @returns {Promise<void>}
     */
    async markTaken(instanceId, medicineLogId) {
      const { error } = await client
        .from(TABLE)
        .update({ status: 'taken', medicine_log_id: medicineLogId })
        .eq('id', instanceId)
        .eq('status', 'pending')

      if (error) throw error
    },
  }
}
