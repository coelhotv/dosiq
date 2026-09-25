/**
 * 085 C2 (smoke do PO) — dose total no CICLO natural da frequência, para leitura clínica.
 *
 * O médico lê posologia ("7,5 mg/semana", "150 mg a cada 90 dias"), não média diária
 * ("0,011 mL/dia"). Este módulo diz qual é o ciclo e quanto se toma nele; a UNIDADE (massa
 * para sólido, unidade de tomada para líquido) fica com cada superfície.
 *
 * Invariante com o estoque: `cycleDoseAmount / cycle.days === perIntake × timesPerDay ×
 * frequencyDailyFactor` para toda frequência com ciclo — o consumo/dia do estoque e a dose do
 * ciclo contam as mesmas doses (teste amarra os dois).
 */
import { getIntervalDays, type AdherenceProtocol } from './adherenceLogic'

export type DoseCycle = { days: number; suffix: string }

type CycleProtocol = AdherenceProtocol & { time_schedule?: unknown }

/** Tomadas por dia declaradas no `time_schedule` (mínimo 1). */
export function scheduleTimesPerDay(protocol: CycleProtocol | null | undefined): number {
  const schedule = Array.isArray(protocol?.time_schedule) ? protocol.time_schedule : []
  return schedule.length > 0 ? schedule.length : 1
}

/** Ciclo da frequência; `null` quando não há ciclo previsível (PRN, N inválido, desconhecida). */
export function getDoseCycle(protocol: CycleProtocol | null | undefined): DoseCycle | null {
  switch (protocol?.frequency) {
    case 'diário':
      return { days: 1, suffix: '/dia' }
    case 'semanal':
    case 'personalizado':
      return { days: 7, suffix: '/semana' }
    case 'dias_alternados':
      return { days: 2, suffix: ' a cada 2 dias' }
    case 'intervalo_dias': {
      const n = getIntervalDays(protocol)
      return n ? { days: n, suffix: ` a cada ${n} dias` } : null
    }
    default:
      return null
  }
}

/** Dias com dose dentro do ciclo: personalizado = dias marcados (vazio ⇒ 7, como o fator); demais = 1. */
function _doseDaysInCycle(protocol: CycleProtocol): number {
  if (protocol.frequency === 'personalizado') {
    return Array.isArray(protocol.weekdays) && protocol.weekdays.length > 0 ? protocol.weekdays.length : 7
  }
  return 1
}

/** Quantidade total no ciclo (na unidade de `perIntake`); `null` sem ciclo ou dose inválida. */
export function cycleDoseAmount(protocol: CycleProtocol | null | undefined, perIntake: number): number | null {
  if (!protocol || !getDoseCycle(protocol) || !Number.isFinite(perIntake)) return null
  return perIntake * scheduleTimesPerDay(protocol) * _doseDaysInCycle(protocol)
}
