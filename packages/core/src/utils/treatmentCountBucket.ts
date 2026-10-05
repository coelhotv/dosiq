/**
 * Persona por volume de tratamentos (spec 092 FR-002 / D-2): faixa de contagem registrada como super
 * property de analytics. Puro: sem query, sem relógio — quem chama passa as linhas e o dia local.
 *
 * Base (PO 27/09): tratamentos com PRESCRIÇÃO VIGENTE no dia — `start_date <= dia` e `end_date` nulo
 * ou `>= dia` (inclusivo, AP-240) —, **inclusive pausados**. Início futuro não conta.
 *
 * 🔴 NÃO "consolidar" com `isProtocolVigentOn` (adherenceLogic): aquele EXCLUI pausados
 *    (`active === false`), porque responde "tem dose a cobrar hoje?". A persona responde "quantos
 *    tratamentos a pessoa administra?" — pausar não muda o perfil de quem gerencia. Nem com o
 *    `isProtocolActiveOnDate` do adherenceLogic, que também olha frequência/dia da semana: um
 *    semanal sem dose hoje continua sendo um tratamento da pessoa.
 * 🔴 NÃO repetir o filtro de datas numa query nova (`createProtocolRepository.ts:199-203`, "7º sítio
 *    de vigência"): o eixo de período já tem dono, `isProtocolInPeriod` (dateUtils).
 */
import { isProtocolActiveOnDate as isProtocolInPeriod } from './dateUtils'

export type TreatmentCountBucket = '0' | '1-3' | '4+'

interface TreatmentPeriodRow {
  start_date?: string | null
  end_date?: string | null
}

/** Quantos tratamentos têm prescrição vigente em `date` (YYYY-MM-DD local), pausados inclusive. */
export function countTreatmentsInPeriod(
  protocols: ReadonlyArray<TreatmentPeriodRow | null | undefined> | null | undefined,
  date: string,
): number {
  if (!Array.isArray(protocols)) return 0
  return protocols.filter((p) => p != null && isProtocolInPeriod(p, date)).length
}

/**
 * Faixa da persona. O corte `4+` coincide com o limiar do modo adaptativo (`> 3`, TodayScreen e
 * TreatmentsScreen), para que faixa e densidade conversem na leitura do PostHog.
 */
export function resolveTreatmentCountBucket(
  protocols: ReadonlyArray<TreatmentPeriodRow | null | undefined> | null | undefined,
  date: string,
): TreatmentCountBucket {
  const count = countTreatmentsInPeriod(protocols, date)
  if (count === 0) return '0'
  return count <= 3 ? '1-3' : '4+'
}
