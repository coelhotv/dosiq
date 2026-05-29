/**
 * doseInstanceScheduler — motor de geração de dose_instances (ADR-048, Fase 2 / S2.4).
 *
 * Roda no processo Node persistente do bot (NÃO no Vercel — não consome o budget de
 * 12 functions, R-090). Usa o client service_role (`server/services/supabase.js`) que
 * ignora RLS → todo acesso é escopado explicitamente por protocolo/usuário (R-042).
 *
 * Reusa a orquestração pura do core (`renewProtocolWindow` / `createDoseInstanceRepository`)
 * — sem reimplementar geração nem recorrência aqui.
 *
 * Responsabilidades do cron diário:
 *  1. Renovar a janela de 30d dos protocolos ativos cujo high-water-mark se aproxima do fim.
 *  2. Limpar instâncias pendentes futuras de protocolos pausados há > 1 dia.
 *
 * Rede de segurança lazy (`ensureInstancesUpTo`) é exportada pelo core e chamada por
 * leituras críticas (dashboard / scheduler de notificação) — não vive aqui.
 */

import { createDoseInstanceRepository, renewProtocolWindow, parseTimestamp } from '@dosiq/core'
import { supabase } from '../services/supabase.js'
import { createLogger } from './logger.js'

const logger = createLogger('DoseInstanceScheduler')

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Renova a janela de geração de todos os protocolos ativos.
 * Idempotente: rodar 2x = mesmo estado (renewProtocolWindow não regenera o que já cobre,
 * e o upsert usa ON CONFLICT DO NOTHING).
 * @returns {Promise<{processed: number, generated: number}>}
 */
export async function generateDoseInstances() {
  const { data: protocols, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('active', true)

  if (error) {
    logger.error('Falha ao buscar protocolos ativos', error)
    throw error
  }

  const doseInstanceRepo = createDoseInstanceRepository({ client: supabase })
  let generated = 0
  for (const protocol of protocols ?? []) {
    try {
      generated += await renewProtocolWindow({ protocol, doseInstanceRepo })
    } catch (err) {
      // Best-effort por protocolo: um erro não derruba a varredura inteira.
      logger.error(`Falha ao renovar janela do protocolo ${protocol.id}`, err)
    }
  }
  logger.info('Geração de dose_instances concluída', { processed: protocols?.length ?? 0, generated })
  return { processed: protocols?.length ?? 0, generated }
}

/**
 * Limpa instâncias pendentes futuras de protocolos pausados há mais de 1 dia.
 * O toggle de pausa só marca as próximas 24h como skipped_paused (trabalho leve);
 * o cron remove o resto depois, evitando varrer tudo no momento do toggle.
 * @returns {Promise<{cleaned: number}>}
 */
export async function cleanupPausedProtocols() {
  const cutoffIso = parseTimestamp(Date.now() - MS_PER_DAY).toISOString()
  const { data: paused, error } = await supabase
    .from('protocols')
    .select('id')
    .eq('active', false)
    .not('paused_at', 'is', null)
    .lt('paused_at', cutoffIso)

  if (error) {
    logger.error('Falha ao buscar protocolos pausados', error)
    throw error
  }

  const doseInstanceRepo = createDoseInstanceRepository({ client: supabase })
  let cleaned = 0
  for (const { id } of paused ?? []) {
    try {
      await doseInstanceRepo.wipeFuturePending(id)
      cleaned += 1
    } catch (err) {
      logger.error(`Falha ao limpar pendentes do protocolo pausado ${id}`, err)
    }
  }
  logger.info('Limpeza de pausados concluída', { cleaned })
  return { cleaned }
}
