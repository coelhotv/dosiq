/**
 * timezoneRegen — regeneração em massa de dose_instances ao mudar o fuso do perfil (F4.3f.2).
 *
 * Quando o usuário declara "Me mudei" na troca de tz (Configurações), as doses
 * precisam re-ancorar do clock-time antigo para o novo fuso: ex. "20:00" deixa de
 * ser 20:00 SP (23:00Z) e passa a 20:00 Londres (20:00Z). Isso muda o INSTANTE
 * ABSOLUTO das ocorrências futuras → exige wipe + regeneração por tratamento ativo.
 *
 * "Estou só de viagem" NÃO chama este helper: o tz é persistido (render/notificação
 * acompanham o device), mas o instante absoluto das doses fica intacto.
 *
 * BEST-EFFORT (R-245/246): falha por tratamento nunca derruba o lote nem bloqueia o
 * persist do tz. O cron + a rede lazy corrigem o resto. Nunca lança ao caller.
 *
 * Regra inviolável (§4 MASTER_PLAN, AP-203): wipeFuturePending só remove `pending`
 * futura — taken/missed/skipped e o passado ficam intactos.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { createDoseInstanceRepository } from '../repositories/createDoseInstanceRepository'
import { computeWindowEnd, planWindow } from './doseInstancePlanner'
import { getServerTimestamp, getTodayLocal, parseISO } from '../utils/dateUtils'

const PROTOCOLS = 'protocols'
const TABLE = 'dose_instances'
const DEFAULT_TZ = 'America/Sao_Paulo'

/**
 * Há ao menos uma dose `pending` futura do usuário? Governa se vale exibir o prompt
 * de intenção (sem dose futura, viagem×mudança não muda nada → persiste o tz direto).
 * Best-effort: erro → false (não bloqueia a troca de tz).
 * @param {Object} client - cliente Supabase autenticado.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function hasFuturePendingDoses(client: SupabaseClient<Database> | null | undefined, userId: string | null | undefined): Promise<boolean> {
  if (!client || !userId) return false
  try {
    const { count, error } = await client
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gt('scheduled_for', getServerTimestamp())
    if (error) return false
    return (count ?? 0) > 0
  } catch {
    return false
  }
}

/**
 * Re-ancora as ocorrências futuras de TODOS os tratamentos ativos do usuário no novo tz.
 * Para cada protocolo ativo: wipeFuturePending → planWindow(now → fim-da-janela, tz novo).
 * O índice único (protocol_id, scheduled_for) + ON CONFLICT DO NOTHING mantém idempotência;
 * como o wipe limpa o futuro antes, as novas instâncias entram já no fuso novo.
 *
 * @param {Object} params
 * @param {Object} params.client - cliente Supabase autenticado (RLS escopa por user_id).
 * @param {string} params.userId
 * @param {string} params.tz - tz IANA de destino (ex: 'Europe/London').
 * @returns {Promise<{processed:number, regenerated:number, failed:number}>}
 */
export async function regenActiveProtocolsForTz({
  client,
  userId,
  tz = DEFAULT_TZ,
}: {
  client: SupabaseClient<Database> | null | undefined
  userId: string | null | undefined
  tz?: string
}): Promise<{ processed: number; regenerated: number; failed: number }> {
  const result = { processed: 0, regenerated: 0, failed: 0 }
  if (!client || !userId) return result

  let protocols: { id: string; user_id: string; end_date?: string | null; [key: string]: unknown }[]
  try {
    const today = getTodayLocal(tz)
    const { data, error } = await client
      .from(PROTOCOLS)
      // 029 F3 (T014): embed da escada N2 deste protocolo — o gerador precisa das etapas
      // filtradas por protocol_id (grátis via FK; ver createProtocolRepository).
      .select('*, titration_steps(id, position, dose, duration_days, status, started_at, description)')
      .eq('user_id', userId)
      .eq('active', true)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
    if (error) return result
    protocols = data ?? []
  } catch {
    return result
  }

  const doseInstanceRepo = createDoseInstanceRepository({ client })
  const now = parseISO(getServerTimestamp())

  for (const protocol of protocols) {
    result.processed += 1
    try {
      await doseInstanceRepo.wipeFuturePending(protocol.id)
      const toTs = computeWindowEnd(protocol, now, tz)
      result.regenerated += await planWindow({
        protocol,
        doseInstanceRepo,
        fromTs: now.toISOString(),
        toTs,
        tz,
      })
    } catch {
      // best-effort por tratamento (R-231/245): cron + lazy net corrigem depois.
      result.failed += 1
    }
  }

  return result
}
