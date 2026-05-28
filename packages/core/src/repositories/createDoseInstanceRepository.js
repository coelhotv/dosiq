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

import { getServerTimestamp, parseISO } from '../utils/dateUtils.js'

const TABLE = 'dose_instances'
const PROTOCOLS = 'protocols'

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
  }
}
