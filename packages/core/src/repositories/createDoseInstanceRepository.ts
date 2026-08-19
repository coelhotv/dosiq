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
// - wipeFuturePending(protocolId)    → DELETE status IN ('pending','skipped_paused') AND scheduled_for > now() (nunca toca passado/taken/missed)
// - getWindow(userId, fromTs, toTs)  → instâncias do usuário na janela, ordenadas
// - countByStatus({userId, protocolId?, fromTs, toTs}) → head-count por status (Fase 3 leitura)
// - markMissedDueInstances({now?}) → pending vencida (scheduled_for+tol < now) → missed (writer #3, F2.5)
// - getGeneratedThrough(protocolId)  → high-water-mark (protocols.generated_through)
// - setGeneratedThrough(protocolId, ts)
// - markSkippedPaused(userId, protocolId, untilTs) → pendentes futuras até untilTs viram
//   skipped_paused. 067/B: via RPC (`set_protocol_dose_state_atomic`, mode `pause_until`).
//   ⚠️ SEM caller de produção hoje — quem pausa tratamento é `markAllFutureSkippedPaused`
//   (`createProtocolRepository.ts:63`). Mantida por ser a variante "pausa até data" da mesma
//   família; se ganhar caller, ele nasce já com a assinatura de 3 args.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { getServerTimestamp, parseISO, parseTimestamp } from '../utils/dateUtils'

const TABLE = 'dose_instances'
const PROTOCOLS = 'protocols'

/** Teto de tolerância (min) — janela de busca grosseira no snap; filtro fino usa o
 *  `tolerance_minutes` de cada linha. Casa com o default/cap da migration (§6 MASTER_PLAN). */
const MAX_TOLERANCE_MINUTES = 120
const MS_PER_MINUTE = 60 * 1000

/** Tamanho de página p/ paginar leituras (AP-186: PostgREST trunca em ~1000 sem erro). */
const PAGE_SIZE = 1000

/**
 * Select das leituras de janela (052 Slice B): colunas da ocorrência + embed do medicamento
 * CONGELADO, pela FK própria `dose_instances_medicine_id_fkey`.
 *
 * O embed vem daqui, e não de cada chamador, porque a identidade de uma dose não pode depender
 * de o consumidor ter carregado o protocolo certo: o medicamento congelado costuma pertencer a
 * um protocolo ANTIGO (é o que a titulação produz), que telas de histórico não têm em contexto.
 * Sem o embed no repositório, essas telas cairiam em nome vazio — melhor que o nome errado do
 * regime anterior, mas ainda uma regressão evitável.
 */
const WINDOW_SELECT = `
  id, user_id, protocol_id, medicine_id, scheduled_for, expected_dose, status,
  medicine_log_id, tolerance_minutes, early_window_minutes, notified_at, snoozed_until, created_at,
  critical_alarm, la_push_started_at, la_push_token, la_push_state,
  medicine:medicines(id, name, type, presentation, dosage_per_pill, dosage_unit,
                     concentration_volume_ml, units_per_ml)
`

/** Converte Date|ISO em ISO string (R-020: sem `new Date()` fora de dateUtils). */
const toIso = (value: Date | string | number) => parseISO(value).toISOString()

interface CreateDoseInstanceRepositoryDeps {
  client: SupabaseClient<Database>
}

interface AnchorCandidate {
  id: string
  scheduled_for: string
  tolerance_minutes: number | null
}

/**
 * Filtro fino de findAnchorInstance: dentro da tolerância da própria linha, pega a mais
 * próxima de `takenMs`. Extraído como função pura — testável sem client/rede.
 */
function _pickClosestAnchor(candidates: AnchorCandidate[], takenMs: number): AnchorCandidate | null {
  let best: AnchorCandidate | null = null
  let bestDiff = Infinity
  for (const inst of candidates) {
    const diff = Math.abs(parseISO(inst.scheduled_for).getTime() - takenMs)
    const tol = (inst.tolerance_minutes ?? MAX_TOLERANCE_MINUTES) * MS_PER_MINUTE
    if (diff <= tol && diff < bestDiff) {
      best = inst
      bestDiff = diff
    }
  }
  return best
}

/**
 * markMissedDueInstances passo 1: lê TODAS as `pending` vencidas via cursor por `id`
 * (AP-186/Gemini #613 — offset pularia linha sob escrita concorrente). Sem side-effect.
 */
async function _scanDueMissedIds(
  client: SupabaseClient<Database>,
  nowIso: string,
  nowMs: number,
  pageSize: number,
): Promise<string[]> {
  const dueIds: string[] = []
  let lastId: string | null = null
  for (;;) {
    let query = client
      .from(TABLE)
      .select('id, scheduled_for, tolerance_minutes')
      .eq('status', 'pending')
      .lt('scheduled_for', nowIso)
      .order('id', { ascending: true })
      .limit(pageSize)

    if (lastId) query = query.gt('id', lastId)

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break

    for (const row of data) {
      const tol = (row.tolerance_minutes ?? MAX_TOLERANCE_MINUTES) * MS_PER_MINUTE
      if (parseISO(row.scheduled_for).getTime() + tol < nowMs) dueIds.push(row.id)
    }

    if (data.length < pageSize) break
    lastId = data[data.length - 1].id
  }
  return dueIds
}

/**
 * markMissedDueInstances passo 2: UPDATE em lotes reafirmando `status='pending'`
 * (guard de corrida — AP-185). Retorna total efetivamente atualizado.
 */
async function _applyMissedUpdates(client: SupabaseClient<Database>, dueIds: string[]): Promise<number> {
  let updated = 0
  const CHUNK = 500
  for (let i = 0; i < dueIds.length; i += CHUNK) {
    const chunk = dueIds.slice(i, i + CHUNK)
    const { data, error } = await client
      .from(TABLE)
      .update({ status: 'missed' })
      .in('id', chunk)
      .eq('status', 'pending')
      .select('id')

    if (error) throw error
    updated += data?.length ?? 0
  }
  return updated
}

export function createDoseInstanceRepository({ client }: CreateDoseInstanceRepositoryDeps) {
  if (!client) throw new Error('createDoseInstanceRepository: client é obrigatório')

  return {
    /**
     * Insere instâncias ignorando conflitos no índice único (protocol_id, scheduled_for).
     * Idempotente: rodar 2x não duplica nem sobrescreve instâncias já materializadas.
     * @param {Array<Object>} instances - linhas prontas (user_id, protocol_id, scheduled_for, expected_dose, tolerance_minutes)
     * @returns {Promise<Array>} linhas efetivamente inseridas
     */
    async upsertMany(instances: Record<string, unknown>[]) {
      if (!Array.isArray(instances) || instances.length === 0) return []
      const { data, error } = await client
        .from(TABLE)
        .upsert(instances as never, {
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
    async wipeFuturePending(protocolId: string) {
      const { error } = await client
        .from(TABLE)
        .delete()
        .eq('protocol_id', protocolId)
        .in('status', ['pending', 'skipped_paused'])
        .gt('scheduled_for', getServerTimestamp())

      if (error) throw error
    },

    /**
     * Versão em lote de wipeFuturePending: remove pendentes futuras de VÁRIOS protocolos
     * num único DELETE (evita N+1 no cron). Mesma regra inviolável: só pending + futuro.
     * @param {string[]} protocolIds
     * @returns {Promise<void>}
     */
    async wipeFuturePendingForProtocols(protocolIds: string[]) {
      if (!Array.isArray(protocolIds) || protocolIds.length === 0) return
      const { error } = await client
        .from(TABLE)
        .delete()
        .in('protocol_id', protocolIds)
        .in('status', ['pending', 'skipped_paused'])
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
    async getWindow(userId: string, fromTs: Date | string, toTs: Date | string) {
      // AP-186: PostgREST trunca em ~1000 linhas SEM erro. Uma janela de 90d de um
      // usuário pesado passa de 1000 ocorrências (visto: 1590) → adesão/timeline
      // truncadas (ex: "942/1000"). Paginar por offset (.range) — leitura pura, sem
      // escrita que mute o filtro, então offset é seguro aqui (≠ sweep, que usa keyset).
      const fromIso = toIso(fromTs)
      const toTsIso = toIso(toTs)
      const out = []
      let from = 0
      for (;;) {
        const { data, error } = await client
          .from(TABLE)
          .select(WINDOW_SELECT)
          .eq('user_id', userId)
          .gte('scheduled_for', fromIso)
          .lte('scheduled_for', toTsIso)
          .order('scheduled_for', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        out.push(...data)
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      return out
    },

    /**
     * High-water-mark de geração do protocolo.
     * @param {string} protocolId
     * @returns {Promise<string|null>} ISO timestamptz ou null
     */
    async getGeneratedThrough(protocolId: string) {
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
    async setGeneratedThrough(protocolId: string, ts: Date | string) {
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
    async setPausedAt(protocolId: string, ts: Date | string | null) {
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
     *
     * 067/B (FR-030): passa por RPC porque `authenticated` VAI perder `UPDATE (status)`
     * (ADR-092). O `REVOKE` está segurado até a versão nova ser majoritária nas lojas
     * ([[R-310]] · `docs/migrations/PENDING.md`) — este caminho existe ANTES dele, de
     * propósito. Estado do TRATAMENTO, não fato clínico da paciente ⇒ NÃO passa pela
     * guarda de janela (Decisão 4).
     * @param {string} userId - dono do protocolo (a RPC valida posse)
     * @param {string} protocolId
     * @returns {Promise<void>}
     */
    async reactivateFuturePaused(userId: string, protocolId: string) {
      const { error } = await client.rpc('set_protocol_dose_state_atomic', {
        p_user_id: userId,
        p_protocol_id: protocolId,
        p_mode: 'resume',
        p_until: null,
      } as never)

      if (error) throw error
    },

    /**
     * Marca TODAS as instâncias pendentes futuras do protocolo como skipped_paused.
     * Usado na pausa imediata — elimina dependência do cron para limpar o restante.
     * 067/B (FR-030): via RPC (ver `reactivateFuturePaused`).
     * @param {string} userId - dono do protocolo (a RPC valida posse)
     * @param {string} protocolId
     * @returns {Promise<void>}
     */
    async markAllFutureSkippedPaused(userId: string, protocolId: string) {
      const { error } = await client.rpc('set_protocol_dose_state_atomic', {
        p_user_id: userId,
        p_protocol_id: protocolId,
        p_mode: 'pause_all',
        p_until: null,
      } as never)

      if (error) throw error
    },

    /**
     * Marca instâncias pendentes futuras até `untilTs` como skipped_paused (pausa não penaliza).
     * 067/B (FR-030): via RPC (ver `reactivateFuturePaused`).
     *
     * ⚠️ **Sem caller de produção** (verificado no C1.5 e reconfirmado no RC6 do PR #797): a pausa
     * de tratamento usa `markAllFutureSkippedPaused`. A cobertura desta função é só de teste — não
     * confundir "testada" com "exercitada em produção".
     * @param {string} userId - dono do protocolo (a RPC valida posse)
     * @param {string} protocolId
     * @param {Date|string} untilTs
     * @returns {Promise<void>}
     */
    async markSkippedPaused(userId: string, protocolId: string, untilTs: Date | string) {
      const { error } = await client.rpc('set_protocol_dose_state_atomic', {
        p_user_id: userId,
        p_protocol_id: protocolId,
        p_mode: 'pause_until',
        p_until: toIso(untilTs),
      } as never)

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
     * pois cada instância tem sua própria tolerância. Elegíveis: `pending` E `missed`
     * (F2.5 self-heal) — um registro retroativo (offline/FAB mobile com dia·hora) cujo
     * `takenAt` cai dentro da tolerância re-ancora a ocorrência que o sweep marcou missed
     * cedo demais. NUNCA re-ancora taken/skipped. Consistente com E1: só cura dentro da
     * janela; tomada genuinamente fora dela (timestamp tardio) não casa → segue missed.
     *
     * @param {Object} args
     * @param {string} args.protocolId
     * @param {Date|string} args.takenAt
     * @returns {Promise<{id: string, scheduled_for: string, tolerance_minutes: number}|null>}
     */
    async findAnchorInstance({ protocolId, takenAt }: { protocolId: string; takenAt: Date | string }) {
      if (!protocolId) return null
      const takenMs = parseISO(takenAt).getTime()
      const lowIso = parseTimestamp(takenMs - MAX_TOLERANCE_MINUTES * MS_PER_MINUTE).toISOString()
      const highIso = parseTimestamp(takenMs + MAX_TOLERANCE_MINUTES * MS_PER_MINUTE).toISOString()

      const { data, error } = await client
        .from(TABLE)
        .select('id, scheduled_for, tolerance_minutes')
        .eq('protocol_id', protocolId)
        .in('status', ['pending', 'missed'])
        .gte('scheduled_for', lowIso)
        .lte('scheduled_for', highIso)

      if (error) throw error
      if (!data || data.length === 0) return null

      return _pickClosestAnchor(data, takenMs)
    },

    /**
     * Conta ocorrências por status numa janela [fromTs, toTs], opcionalmente de um protocolo.
     * Usa head-count por status (count exact, head:true) → NÃO traz linhas, então
     * imune ao truncamento de ~1000 do PostgREST (AP-186 não se aplica: sem fetch de rows).
     * @param {Object} args
     * @param {string} args.userId
     * @param {string} [args.protocolId] - se presente, restringe ao protocolo
     * @param {Date|string} args.fromTs
     * @param {Date|string} args.toTs
     * @returns {Promise<{taken:number, missed:number, pending:number, skipped_paused:number, skipped_user:number}>}
     */
    async countByStatus({
      userId,
      protocolId,
      fromTs,
      toTs,
    }: {
      userId: string
      protocolId?: string
      fromTs: Date | string
      toTs: Date | string
    }) {
      const statuses = ['taken', 'missed', 'pending', 'skipped_paused', 'skipped_user'] as const
      const fromIso = toIso(fromTs)
      const toTsIso = toIso(toTs)

      // Consultas independentes por status → paralelizar (Promise.all). `head:true`
      // não traz linhas; `select('id')` mantém o head-count enxuto (Gemini #612).
      const counts = await Promise.all(
        statuses.map(async (s) => {
          let q = client
            .from(TABLE)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', s)
            .gte('scheduled_for', fromIso)
            .lte('scheduled_for', toTsIso)
          if (protocolId) q = q.eq('protocol_id', protocolId)
          const { count, error } = await q
          if (error) throw error
          return count ?? 0
        }),
      )

      const result: Record<(typeof statuses)[number], number> = {} as Record<(typeof statuses)[number], number>
      statuses.forEach((s, i) => { result[s] = counts[i] })
      return result
    },

    /**
     * Varre `pending` vencidas e marca `missed` (writer #3 da máquina de estados, F2.5).
     * Uma instância vence quando `scheduled_for + tolerance_minutes < now` sem tomada.
     * A tolerância varia por linha (slot), então o teste fino é em JS — o SELECT só
     * estreita por `scheduled_for < now`.
     *
     * AP-186: lê TODAS as candidatas (paginado) ANTES de qualquer escrita — o UPDATE
     * muda o filtro `status='pending'`, então ler-depois-escrever evita truncar/pular.
     * AP-185: o UPDATE reafirma `status='pending'` (guard contra corrida com markTaken).
     * Idempotente: rodar 2x não re-marca nada (já saíram do conjunto pending).
     *
     * @param {Object} [args]
     * @param {Date|string} [args.now] - instante de referência (default: agora)
     * @param {number} [args.pageSize=1000]
     * @returns {Promise<number>} nº de instâncias marcadas como missed
     */
    async markMissedDueInstances({
      now = getServerTimestamp(),
      pageSize = 1000,
    }: { now?: Date | string; pageSize?: number } = {}) {
      const nowObj = parseISO(now)
      const nowMs = nowObj.getTime()
      const nowIso = nowObj.toISOString()

      // 1. Ler todas as pending já no passado, SEM escrever (AP-186/Gemini #613).
      const dueIds = await _scanDueMissedIds(client, nowIso, nowMs, pageSize)
      if (dueIds.length === 0) return 0

      // 2. UPDATE em lotes por id, reafirmando pending (guard de corrida — AP-185).
      return _applyMissedUpdates(client, dueIds)
    },

    /**
     * Liga instância ↔ log: marca a ocorrência como `taken` e grava o `medicine_log_id`.
     * FP-1 (ADR-050): NÃO compara `quantity_taken` com `expected_dose` — a dose aplicada
     * pode divergir da planejada (bolus variável futuro). Ancora a partir de `pending`
     * OU `missed` (F2.5 self-heal: registro retroativo dentro da tolerância reverte um
     * missed marcado cedo pelo sweep). NUNCA re-ancora `taken`/`skipped_*`.
     *
     * Retorna `true` SOMENTE se a reserva pegou (linha afetada). Em corrida, a 2ª tomada
     * encontra a instância já `taken` → update no-op (filtro pending/missed não casa) →
     * retorna `false`, e o caller NÃO deve gravar `dose_instance_id` no log (evita elo
     * unidirecional/órfão — Gemini #609, AP-185).
     * @param {string} instanceId
     * @param {string} medicineLogId
     * @returns {Promise<boolean>} true se a instância foi efetivamente reservada
     */
    async markTaken(instanceId: string, medicineLogId: string) {
      const { data, error } = await client
        .from(TABLE)
        .update({ status: 'taken', medicine_log_id: medicineLogId })
        .eq('id', instanceId)
        .in('status', ['pending', 'missed', 'skipped_user'])
        .select('id')

      if (error) throw error
      return !!(data && data.length > 0)
    },

    /**
     * Persiste o timestamp de soneca de uma ocorrência (FR-010).
     * Limpar: passar null quando a dose for resolvida (taken/skipped) ou a soneca esgotar.
     * @param {string} instanceId
     * @param {Date|string|null} ts - ISO timestamp ou null para limpar
     * @returns {Promise<void>}
     */
    async setSnoozedUntil(instanceId: string, ts: Date | string | number | null) {
      const isoValue = ts === null
        ? null
        : typeof ts === 'number'
          ? parseTimestamp(ts).toISOString()
          : toIso(ts)

      const { error } = await client
        .from(TABLE)
        .update({ snoozed_until: isoValue })
        .eq('id', instanceId)

      if (error) throw error
    },

    /**
     * Retorna instância completa por ID (incluindo medicine_log_id, scheduled_for, tolerance_minutes).
     * @param {string} instanceId
     * @returns {Promise<object|null>}
     */
    async getById(instanceId: string) {
      const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('id', instanceId)
        .single()

      if (error) throw error
      return data
    },

    /**
     * Reverte instância para status não-registrado: status = newStatus, medicine_log_id = null.
     * Só executa se status atual for 'taken' (guarda contra double-revert).
     * @param {string} instanceId
     * @param {'pending'|'missed'} newStatus
     * @returns {Promise<boolean>} true se linha foi atualizada
     */
    async revertToUnregistered(instanceId: string, newStatus: 'pending' | 'missed') {
      const { data, error } = await client
        .from(TABLE)
        .update({ status: newStatus, medicine_log_id: null })
        .eq('id', instanceId)
        .eq('status', 'taken')
        .select('id')

      if (error) throw error
      return !!(data && data.length > 0)
    },
  }
}
