/**
 * doseInstancePlanner — orquestra geração + persistência de dose_instances (ADR-048, Fase 2).
 *
 * Camada entre o gerador puro (`generateInstances`) e o repository de I/O
 * (`createDoseInstanceRepository`). Reusado por DOIS chamadores (DRY):
 *  - cron server-side (service_role) — varredura/renovação em lote;
 *  - lifecycle hooks da factory de protocolo (client authenticated) — geração imediata.
 *
 * Injeção de dependência: recebe `doseInstanceRepo` pronto → testável e agnóstico
 * de plataforma (qual client Supabase é detalhe do chamador).
 *
 * tz: default 'America/Sao_Paulo' (G1 — injeção real do tz do usuário fica para a
 * Fase 3; hoje 99% SP, consistente).
 */

import { generateInstances } from '../utils/doseInstanceGenerator'
import { parseISO, parseTimestamp, getServerTimestamp, getEndOfDayISO } from '../utils/dateUtils'
import type { TitrationStepLike } from '../utils/titrationUtils'
import type { createDoseInstanceRepository } from '../repositories/createDoseInstanceRepository'

type DoseInstanceRepo = ReturnType<typeof createDoseInstanceRepository>

interface Protocol {
  id: string
  end_date?: string | null
  /**
   * Etapas da escada N2 DESTE protocolo (spec 029 F3/T014). Vêm de graça no embed
   * `titration_steps(...)` do select — a FK `titration_steps.protocol_id → protocols.id` faz o
   * PostgREST filtrar por protocolo, que é exatamente o recorte que o gerador precisa (a escada
   * inteira vazaria a dose de outro medicamento no caso cross-med). Ausente = titulação N1/nenhuma.
   */
  titration_steps?: TitrationStepLike[] | null
  [key: string]: unknown
}

/** Janela padrão de geração para protocolos contínuos (sem end_date). */
export const WINDOW_DAYS = 30
/** Renova quando o high-water-mark está a menos de N dias do fim da janela. */
export const RENEWAL_THRESHOLD_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Fim-alvo da janela de geração de um protocolo, em ISO.
 * - com `end_date`: o fim do dia de end_date (não passa disso);
 * - contínuo: `baseTs + WINDOW_DAYS` dias.
 * @param {Object} protocol
 * @param {Date} baseDate - âncora (normalmente agora)
 * @returns {string} ISO UTC
 */
export function computeWindowEnd(protocol: Protocol, baseDate: Date, tz = 'America/Sao_Paulo'): string {
  const continuousEnd = parseTimestamp(baseDate.getTime() + WINDOW_DAYS * MS_PER_DAY).toISOString()
  if (!protocol.end_date) return continuousEnd
  const endOfEndDate = getEndOfDayISO(protocol.end_date, tz) // ISO do fim do dia de end_date no tz do dono
  // o menor entre (fim do protocolo) e (janela contínua)
  return parseISO(endOfEndDate).getTime() < parseISO(continuousEnd).getTime() ? endOfEndDate : continuousEnd
}

/**
 * Gera e persiste (idempotente) as instâncias de um protocolo numa janela [fromTs, toTs],
 * e avança o high-water-mark para toTs.
 * @param {Object} params
 * @param {Object} params.protocol
 * @param {Object} params.doseInstanceRepo - repo com upsertMany/setGeneratedThrough
 * @param {Date|string|number} params.fromTs
 * @param {Date|string|number} params.toTs
 * @param {string} [params.tz]
 * @returns {Promise<number>} nº de instâncias geradas (antes do ON CONFLICT)
 */
export async function planWindow({
  protocol,
  doseInstanceRepo,
  fromTs,
  toTs,
  tz = 'America/Sao_Paulo',
  titrationSteps,
}: {
  protocol: Protocol
  doseInstanceRepo: DoseInstanceRepo
  fromTs: Date | string | number
  toTs: Date | string | number
  tz?: string
  titrationSteps?: TitrationStepLike[] | null
}): Promise<number> {
  const instances = generateInstances(protocol, fromTs, toTs, tz, titrationSteps ?? protocol.titration_steps)
  if (instances.length > 0) {
    await doseInstanceRepo.upsertMany(instances)
  }
  await doseInstanceRepo.setGeneratedThrough(protocol.id, toIsoLike(toTs))
  return instances.length
}

/**
 * Reprojeta a janela futura de um protocolo do zero: apaga as `pending` futuras e regenera.
 *
 * 🔴 **Por que existe (029 F5.5, smoke do PO 2026-07-19).** Toda escrita em `protocols` que passa
 * pelo repositório dispara `syncInstancesOnWrite`, que faz exatamente isto quando um campo de
 * agendamento muda (`dosage_per_intake` inclusive). A RPC `confirm_titration_switch` é a ÚNICA
 * porta de escrita em `protocols` fora do repositório — ela é SQL, e o gerador é JS —, então a
 * troca de etapa escapava da sincronização inteira:
 *   - `medicine_switch`: o protocolo que a RPC CRIA nasce sem instância nenhuma. O calendário do
 *     paciente que acabou de confirmar a etapa fica VAZIO até o cron das ~03:00. Numa dose
 *     semanal isso dura quase um dia (achado do smoke).
 *   - `dose_change`: a RPC atualiza `dosage_per_intake`, mas as instâncias futuras já
 *     materializadas guardam a `expected_dose` congelada pelo cronograma ANTERIOR. Quando a
 *     confirmação não cai na data prevista — que é a regra, já que ela espera o toque do usuário
 *     — o tratamento passa a dizer uma dose e o lembrete a entregar outra. Pior que a ausência.
 *
 * Ausência de dose assusta; dose errada notificada é um risco clínico. Por isso a troca de etapa
 * passa a fazer o mesmo que editar um tratamento faz: mudar o estado de execução de um tratamento
 * é mudar o tratamento.
 *
 * Agnóstico de client, como o resto do planner: recebe o protocolo (COM o embed
 * `titration_steps` — sem ele o gerador degrada a dose para `dosage_per_intake` em silêncio,
 * CON-032) e o repo prontos. Quem busca é o chamador.
 *
 * @returns {Promise<number>} nº de instâncias geradas na janela nova
 */
export async function resyncProtocolWindow({
  protocol,
  doseInstanceRepo,
  tz = 'America/Sao_Paulo',
}: {
  protocol: Protocol
  doseInstanceRepo: DoseInstanceRepo
  tz?: string
}): Promise<number> {
  // Apaga só as FUTURAS pending: o passado é histórico e não se reescreve, e `taken`/`missed`
  // futuras não existem. Mesma ordem do write-path (wipe → regen), pelo mesmo motivo: o upsert
  // é `ON CONFLICT DO NOTHING`, então sem o wipe a instância velha (dose antiga) sobreviveria.
  //
  // ⚠️ NÃO É ATÔMICO, e isso é herdado do write-path, não introduzido aqui (achado do RC6).
  // Se o `planWindow` falhar depois do wipe, o protocolo fica sem instância futura até o cron —
  // que o recolhe justamente porque o `generated_through` NÃO avançou (o `setGeneratedThrough`
  // mora no fim do planWindow). Ou seja: a falha degrada para o comportamento ANTIGO (esperar o
  // cron), nunca para um estado que a malha não enxergue. Tornar isto atômico exige uma RPC que
  // faça wipe+insert numa transação — endurecimento válido, mas que vale para os DOIS caminhos,
  // não só para este; fazê-lo aqui só criaria assimetria.
  await doseInstanceRepo.wipeFuturePending(protocol.id)
  const now = parseISO(getServerTimestamp())
  return planWindow({
    protocol,
    doseInstanceRepo,
    fromTs: now.toISOString(),
    toTs: computeWindowEnd(protocol, now, tz),
    tz,
  })
}

/**
 * Rede de segurança lazy: garante que o protocolo tenha instâncias geradas até `ts`.
 * Gera apenas o gap entre o high-water-mark e `ts` (capado no fim do protocolo).
 * No-op se já coberto.
 * @returns {Promise<number>} instâncias geradas no gap (0 se já coberto)
 */
export async function ensureInstancesUpTo({
  protocol,
  doseInstanceRepo,
  ts,
  tz = 'America/Sao_Paulo',
}: {
  protocol: Protocol
  doseInstanceRepo: DoseInstanceRepo
  ts: Date | string | number | null | undefined
  tz?: string
}): Promise<number> {
  const nowMs = parseISO(getServerTimestamp()).getTime()
  const requestedMs = parseISO(toIsoLike(ts)).getTime()
  // alvo efetivo = min(ts pedido, fim-alvo da janela do protocolo)
  const windowEndIso = computeWindowEnd(protocol, parseTimestamp(requestedMs), tz)
  const targetMs = Math.min(requestedMs, parseISO(windowEndIso).getTime())
  const target = parseTimestamp(targetMs).toISOString()

  const hwm = await doseInstanceRepo.getGeneratedThrough(protocol.id)
  if (hwm && parseISO(hwm).getTime() >= targetMs) return 0 // já coberto

  // Clamp: nunca gerar a partir do passado (evita criar `pending` retroativo se o
  // hwm ficar atrás de `now` — backfill histórico é responsabilidade de outro fluxo).
  const fromMs = Math.max(hwm ? parseISO(hwm).getTime() : nowMs, nowMs)
  return planWindow({ protocol, doseInstanceRepo, fromTs: parseTimestamp(fromMs).toISOString(), toTs: target, tz })
}

/** Converte Date|ISO|ms em ISO (R-020: sem `new Date()` direto). Null-safe. */
function toIsoLike(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return getServerTimestamp()
  if (typeof value === 'number') return parseTimestamp(value).toISOString()
  if (typeof value === 'string') return value
  if (typeof value.getTime === 'function') return parseTimestamp(value.getTime()).toISOString()
  return getServerTimestamp()
}

/**
 * Renova a janela de um protocolo se o high-water-mark se aproxima do fim
 * (usado pelo cron). Gera de `now` (ou do hwm) até `now + WINDOW_DAYS`.
 * Não regenera se o hwm ainda está longe do fim.
 *
 * @param {Object} params
 * @param {string|null} [params.generatedThrough] - high-water-mark já conhecido (ex: vindo
 *   da linha do protocolo já buscada com `select('*')`). Quando fornecido (inclui `null`
 *   explícito), evita o SELECT redundante `getGeneratedThrough` — chave p/ escala (ADR-051).
 *   Omitir (`undefined`) mantém o fallback que busca no repo.
 * @returns {Promise<number>} instâncias geradas (0 se não precisou renovar)
 */
export async function renewProtocolWindow({
  protocol,
  doseInstanceRepo,
  generatedThrough,
  now = parseISO(getServerTimestamp()),
  tz = 'America/Sao_Paulo',
}: {
  protocol: Protocol
  doseInstanceRepo: DoseInstanceRepo
  generatedThrough?: string | null
  now?: Date
  tz?: string
}): Promise<number> {
  const targetIso = computeWindowEnd(protocol, now, tz)
  const targetMs = parseISO(targetIso).getTime()
  const hwm = generatedThrough !== undefined
    ? generatedThrough
    : await doseInstanceRepo.getGeneratedThrough(protocol.id)

  if (hwm) {
    const hwmMs = parseISO(hwm).getTime()
    if (hwmMs >= targetMs) return 0 // janela já cobre o alvo
    const thresholdMs = now.getTime() + RENEWAL_THRESHOLD_DAYS * MS_PER_DAY
    if (hwmMs > thresholdMs) return 0 // ainda longe do fim — não renova ainda
    // Clamp: nunca gerar a partir do passado (sem `pending` retroativo).
    const fromMs = Math.max(hwmMs, now.getTime())
    return planWindow({ protocol, doseInstanceRepo, fromTs: parseTimestamp(fromMs).toISOString(), toTs: targetIso, tz })
  }
  // nunca gerado: gera do agora até o alvo
  return planWindow({ protocol, doseInstanceRepo, fromTs: now.toISOString(), toTs: targetIso, tz })
}
