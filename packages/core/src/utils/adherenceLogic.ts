/**
 * Adherence Logic - Funções puras para cálculo de adesão client-side
 *
 * Migrado de adherenceService para suportar "Custo Zero" de queries.
 * @module adherenceLogic
 */

import {
  parseLocalDate,
  formatLocalDate,
  isProtocolActiveOnDate as isProtocolInPeriod,
  getNow,
  parseISO,
  daysDifference,
  getSaoPauloTime,
  getUserTime,
  cloneDate,
  parseTimestamp
} from './dateUtils'
// `doseToMl` mora em doseUnit.ts (junto de `densityFor`, de quem depende): manter os dois
// separados criava um ciclo doseUnit → adherenceLogic → doseUnit.
import { doseToMl } from './doseUnit'

export interface AdherenceProtocol {
  id?: string
  // 052: `protocols.medicine_id` é NULLABLE no banco (information_schema, 2026-07-19) — hoje 0 de
  // 70 linhas com NULL, mas o estado é representável e o tipo tem que dizer a verdade.
  medicine_id?: string | null
  time_schedule?: string[] | null
  frequency?: string | null
  weekdays?: string[] | null
  days?: string[] | null
  start_date?: string | null
  end_date?: string | null
  active?: boolean
  dosage_per_intake?: number | null
  intake_unit?: string | null
  medicine?: {
    dosage_unit?: string | null
    units_per_ml?: number | null
    dosage_per_pill?: number | null
  } | null
}

interface AdherenceLog {
  taken_at?: string
  protocol_id?: string
  quantity_taken?: number
  [key: string]: unknown
}

interface ExpectedDoseSlot {
  protocolId?: string
  medicineId?: string
  scheduledTime: string
  expectedQuantity: number
  protocol: AdherenceProtocol
  medicine: AdherenceProtocol['medicine']
}

interface DoseRecord {
  [key: string]: unknown
  scheduledTime?: string | null
  status?: string
  taken_at?: string
}

interface DoseInstance {
  status?: string
  expected_dose?: number
  quantity_taken?: number
  scheduled_for?: string
}

// Invariantes de Negócio (R-022, R-129)
const TOLERANCE_WINDOW_HOURS = 2
const TOLERANCE_WINDOW_MS = TOLERANCE_WINDOW_HOURS * 60 * 60 * 1000
const TOLERANCE_WINDOW_MINUTES = TOLERANCE_WINDOW_HOURS * 60

/**
 * Calcula doses esperadas para um conjunto de protocolos em um período.
 * Considera start_date e end_date para calcular dias efetivos de cada protocolo.
 *
 * @param {Array} protocols - Lista de protocolos
 * @param {number} days - Número de dias do período de análise
 * @param {Date} endDate - Data final do período (padrão: hoje)
 * @returns {number} Total de doses esperadas
 */
function getWeeklyRate(protocol: AdherenceProtocol, timesPerDay: number): number {
  const days = getProtocolDays(protocol)
  const numDays = days.length
  return timesPerDay * (numDays > 0 ? numDays : 1) / 7
}

const FREQUENCY_RATE_STRATEGIES: Record<string, (timesPerDay: number, protocol: AdherenceProtocol) => number> = {
  daily: (timesPerDay) => timesPerDay,
  diariamente: (timesPerDay) => timesPerDay,
  'diário': (timesPerDay) => timesPerDay,
  weekly: (timesPerDay, protocol) => getWeeklyRate(protocol, timesPerDay),
  semanal: (timesPerDay, protocol) => getWeeklyRate(protocol, timesPerDay),
  semanalmente: (timesPerDay, protocol) => getWeeklyRate(protocol, timesPerDay),
  personalizado: (timesPerDay, protocol) => getWeeklyRate(protocol, timesPerDay),
  every_other_day: (timesPerDay) => timesPerDay / 2,
  dia_sim_dia_nao: (timesPerDay) => timesPerDay / 2,
  'dia sim, dia não': (timesPerDay) => timesPerDay / 2,
  dias_alternados: (timesPerDay) => timesPerDay / 2,
  quando_necessário: () => 0,
}

/**
 * Calcula a taxa de doses diárias de um protocolo conforme sua frequência
 * @param {Object} protocol - O objeto do protocolo
 * @returns {number} Taxa de doses por dia
 */
export function getDailyDoseRate(protocol: AdherenceProtocol | null | undefined): number {
  if (!protocol) return 0
  const frequency = (protocol.frequency || 'daily').toLowerCase()
  const timesPerDay = protocol.time_schedule?.length || 1
  const strategy = FREQUENCY_RATE_STRATEGIES[frequency]
  if (strategy) {
    return strategy(timesPerDay, protocol)
  }
  return timesPerDay
}

/**
 * Calcula o número de dias efetivos de um protocolo dentro de um período de análise
 * @param {Object} protocol - Protocolo com start_date e end_date opcionais
 * @param {Date} periodStart - Início do período de análise
 * @param {Date} periodEnd - Fim do período de análise
 * @returns {number} Número de dias efetivos (interseção entre protocolo e período)
 */
function getEffectiveDays(protocol: AdherenceProtocol, periodStart: Date, periodEnd: Date): number {
  // Sem start_date: assume ativo desde o início do período
  const protocolStartDate = protocol.start_date
    ? parseLocalDate(protocol.start_date)
    : periodStart

  // Sem end_date: assume protocolo ainda ativo
  const protocolEndDate = protocol.end_date ? parseLocalDate(protocol.end_date) : periodEnd

  // Interseção entre período do protocolo e período de análise
  const effectiveStart = parseTimestamp(Math.max(protocolStartDate.getTime(), periodStart.getTime()))
  const effectiveEnd = parseTimestamp(Math.min(protocolEndDate.getTime(), periodEnd.getTime()))

  if (effectiveEnd < effectiveStart) return 0

  // effectiveEnd é T23:59:59, então Math.ceil conta o dia final corretamente
  const diffTime = effectiveEnd.getTime() - effectiveStart.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function calculateExpectedDoses(protocols: AdherenceProtocol[] | null | undefined, days: number, endDate: Date = getNow()): number {
  if (!protocols || protocols.length === 0) return 0

  const periodStart = cloneDate(endDate)
  periodStart.setHours(0, 0, 0, 0)
  periodStart.setDate(periodStart.getDate() - days + 1)

  const periodEnd = cloneDate(endDate)
  periodEnd.setHours(23, 59, 59, 999)

  return protocols.reduce((total, protocol) => {
    const dailyDoses = getDailyDoseRate(protocol)
    const effectiveDays = getEffectiveDays(protocol, periodStart, periodEnd)
    return total + dailyDoses * Math.max(effectiveDays, 0)
  }, 0)
}

/**
 * Verifica se um protocolo foi seguido para um determinado horário,
 * implementando a janela de +/- 2h de tolerância.
 *
 * @param {string} scheduledTime - Horário previsto "HH:mm" (local)
 * @param {Array} logs - Lista de logs (em UTC)
 * @param {string} dateStr - Data local de referência "YYYY-MM-DD"
 * @returns {boolean}
 */
export function isProtocolFollowed(scheduledTime: string, logs: AdherenceLog[] | null | undefined, dateStr: string): boolean {
  if (!scheduledTime || !logs || logs.length === 0) return false

  return logs.some((log) => {
    if (!log.taken_at) return false
    // 1. Verificar se o log é do mesmo dia local
    const logDateStr = formatLocalDate(getSaoPauloTime(parseISO(log.taken_at)))

    if (logDateStr !== dateStr) return false

    // 2. Verificar janela de 2h
    return isDoseInToleranceWindow(scheduledTime, log.taken_at)
  })
}

/**
 * Verifica se uma dose foi tomada dentro da janela de tolerância de +/- 2 horas.
 *
 * @param {string} scheduledTime - Horário previsto "HH:mm" (local)
 * @param {string} logTakenAt - ISO timestamp do log (UTC)
 * @returns {boolean}
 */
export function isDoseInToleranceWindow(scheduledTime: string | null | undefined, logTakenAt: string | null | undefined): boolean {
  if (!scheduledTime || !logTakenAt) return false

  const [sH, sM] = scheduledTime.split(':').map(Number)
  
  // R-020: Normalizar data tomada para fuso de SP (shifted)
  const takenDate = getSaoPauloTime(parseISO(logTakenAt))

  // Criamos um objeto Date para o horário previsto no MESMO DIA da dose tomada,
  // usando o mesmo referencial (shifted SP) para paridade aritmética.
  const scheduledDate = cloneDate(takenDate)
  scheduledDate.setHours(sH, sM, 0, 0)

  const diffMs = Math.abs(takenDate.getTime() - scheduledDate.getTime())

  return diffMs <= TOLERANCE_WINDOW_MS
}

/**
 * Calcula o horário da próxima dose baseado no cronograma do protocolo
 * Inclui janela de tolerância de 2 horas após o horário agendado.
 * @param {Object} protocol
 * @returns {string} HH:mm ou '--:--'
 */
export function getNextDoseTime(protocol: AdherenceProtocol | null | undefined): string {
  if (!protocol || !protocol.time_schedule || protocol.time_schedule.length === 0) {
    return '--:--'
  }

  const now = getNow()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Converte horários do cronograma para minutos e ordena
  const scheduleMinutes = (protocol.time_schedule ?? [])
    .map((time: string) => {
      const [h, m] = time.split(':').map(Number)
      return h * 60 + m
    })
    .sort((a: number, b: number) => a - b)

  // Janela de tolerância: 2 horas (120 minutos)
  const toleranceWindowMinutes = TOLERANCE_WINDOW_MINUTES

  // Encontra o próximo horário hoje (incluindo janela de 2h de tolerância)
  // Uma dose é considerada "ativa" até 2 horas após o horário agendado
  const nextToday = scheduleMinutes.find((m) => m + toleranceWindowMinutes > currentMinutes)

  if (nextToday !== undefined) {
    const h = String(Math.floor(nextToday / 60)).padStart(2, '0')
    const m = String(nextToday % 60).padStart(2, '0')
    return `${h}:${m}`
  }

  // Se não houver mais doses hoje, retorna a primeira dose de amanhã
  const firstTomorrow = scheduleMinutes[0]
  const h = String(Math.floor(firstTomorrow / 60)).padStart(2, '0')
  const m = String(firstTomorrow % 60).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Calcula o horário final da janela de tolerância (2h após a próxima dose).
 * Retorna null se não houver próxima dose ou se a dose é do dia seguinte.
 * @param {string} nextDoseTime - Horário da próxima dose no formato HH:mm
 * @returns {string|null} Horário final da janela (HH:mm) ou null
 */
export function getNextDoseWindowEnd(nextDoseTime: string | null | undefined): string | null {
  if (!nextDoseTime || nextDoseTime === '--:--') {
    return null
  }

  const [hours, minutes] = nextDoseTime.split(':').map(Number)
  const windowEndMinutes = hours * 60 + minutes + TOLERANCE_WINDOW_MINUTES // +2 horas

  const endHours = String(Math.floor(windowEndMinutes / 60) % 24).padStart(2, '0')
  const endMinutes = String(windowEndMinutes % 60).padStart(2, '0')

  return `${endHours}:${endMinutes}`
}

/**
 * Verifica se a próxima dose está dentro da janela de tolerância (dentro das 2h).
 * @param {string} nextDoseTime - Horário da próxima dose no formato HH:mm
 * @returns {boolean} true se estiver dentro da janela de tolerância
 */
export function isInToleranceWindow(nextDoseTime: string | null | undefined): boolean {
  if (!nextDoseTime || nextDoseTime === '--:--') {
    return false
  }

  const now = getNow()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [hours, minutes] = nextDoseTime.split(':').map(Number)
  const doseMinutes = hours * 60 + minutes
  const toleranceWindowMinutes = TOLERANCE_WINDOW_MINUTES

  // Está dentro da janela se o horário atual for maior que o agendado
  // mas menor que o agendado + 2 horas
  return currentMinutes > doseMinutes && currentMinutes <= doseMinutes + toleranceWindowMinutes
}

/**
 * Calcula a ingestão diária total de um medicamento baseado em seus protocolos ativos
 * @param {string} medicineId
 * @param {Array} protocols
 * @returns {number}
 */
/**
 * Fator médio de doses por DIA de uma frequência (012 Fase B2 — corrige o consumo
 * de líquidos não-diários, ex.: GLP-1 semanal). Sem isso, semanal/dias_alternados
 * eram tratados como diários (estoque "dias restantes" 7×/2× menor).
 *
 * @param {{frequency?: string, weekdays?: string[]}} p
 * @returns {number} fração de dose por dia (diário=1, semanal=1/7, alternados=1/2...)
 */
export function frequencyDailyFactor(p: AdherenceProtocol | null | undefined): number {
  switch (p?.frequency) {
    case 'semanal':
      return 1 / 7
    case 'dias_alternados':
      return 1 / 2
    case 'personalizado':
      return (Array.isArray(p?.weekdays) && p.weekdays.length > 0 ? p.weekdays.length : 7) / 7
    default:
      // diário e quando_necessário mantêm 1 (PRN sem cadência previsível).
      return 1
  }
}

/**
 * Calcula consumo diário do medicamento somando todos os protocolos ativos.
 * Para líquidos (medicine.dosage_unit termina em '/ml'), converte a dose de cada
 * protocolo para ml — alinhando a unidade ao saldo de estoque (que é em ml).
 *
 * @param {string} medicineId
 * @param {Array} protocols
 * @param {Object|null} [medicine] - quando informado e líquido, converte doses p/ ml
 * @returns {number} consumo diário (em unidades de tomada, ou em ml se líquido)
 */
export function calculateDailyIntake(medicineId: string | null | undefined, protocols: AdherenceProtocol[] | null | undefined, medicine: AdherenceProtocol['medicine'] = null): number {
  if (!protocols) return 0

  const isLiquid = Boolean(medicine?.dosage_unit?.endsWith('/ml'))
  const unitsPerMl = medicine?.units_per_ml
  const mgConcentration = medicine?.dosage_per_pill

  return protocols
    .filter((p) => p.medicine_id === medicineId && p.active)
    .reduce((total, p) => {
      const dosesPerSlotDay = p.time_schedule?.length || 1
      const dosage = p.dosage_per_intake || 1
      const perDose = isLiquid ? doseToMl(dosage, p.intake_unit, unitsPerMl, mgConcentration) : dosage
      // Aplica a cadência da frequência: semanal/alternados/personalizado não
      // consomem todo dia (012 Fase B2 — antes inflavam o consumo diário).
      return total + dosesPerSlotDay * perDose * frequencyDailyFactor(p)
    }, 0)
}

/**
 * Calcula dias restantes de estoque
 * @param {number} totalQuantity
 * @param {number} dailyIntake
 * @returns {number}
 */
export function calculateDaysRemaining(totalQuantity: number, dailyIntake: number): number {
  if (dailyIntake <= 0) return Infinity
  return Math.floor(totalQuantity / dailyIntake)
}

/**
 * Calcula doses para uma data específica, classificando em tomadas, perdidas e agendadas
 *
 * @param {string} date - Data em formato YYYY-MM-DD (horário local Brasil)
 * @param {Array} logs - Logs de medicamentos do dia
 * @param {Array} protocols - Protocolos ativos
 * @returns {Object} { takenDoses: [], missedDoses: [], scheduledDoses: [] }
 */
export function calculateDosesByDate(
  date: string,
  logs: AdherenceLog[] | null | undefined,
  protocols: AdherenceProtocol[] | null | undefined,
  now: Date = getNow()
): { takenDoses: DoseRecord[]; missedDoses: DoseRecord[]; scheduledDoses: DoseRecord[] } {
  if (!date || !protocols || protocols.length === 0) {
    return { takenDoses: [], missedDoses: [], scheduledDoses: [] }
  }

  const takenDoses: DoseRecord[] = []
  const missedDoses: DoseRecord[] = []
  const scheduledDoses: DoseRecord[] = []

  // Filtrar protocolos aplicáveis para esta data
  const applicableProtocols = protocols.filter((p: AdherenceProtocol) => isProtocolActiveOnDate(p, date))

  // Gerar slots de doses esperados para cada protocolo aplicável
  const expectedDoses: ExpectedDoseSlot[] = []
  applicableProtocols.forEach((protocol: AdherenceProtocol) => {
    const schedule = protocol.time_schedule || []
    schedule.forEach((time: string) => {
      expectedDoses.push({
        protocolId: protocol.id,
        // null (banco) e undefined (ausente) significam a MESMA coisa para o slot: sem
        // medicamento. Normalizar aqui evita propagar os dois vocabulários pro cálculo de adesão.
        medicineId: protocol.medicine_id ?? undefined,
        scheduledTime: time,
        expectedQuantity: protocol.dosage_per_intake || 1,
        protocol: protocol,
        medicine: protocol.medicine || null,
      })
    })
  })

  // Criar cópia dos logs para rastrear quais já foram associados
  const unmatchedLogs = [...(logs || [])]

  // Para cada dose esperada, tentar encontrar um log correspondente
  expectedDoses.forEach((expectedDose) => {
    let matchedLogIndex = -1

    // Procurar log que corresponda a este horário esperado
    for (let i = 0; i < unmatchedLogs.length; i++) {
      const log = unmatchedLogs[i]

      // Verificar se o log é do mesmo protocolo
      if (log.protocol_id !== expectedDose.protocolId) continue

      // Verificar se está na janela de tolerância (+/- 2h)
      if (isDoseInToleranceWindow(expectedDose.scheduledTime, log.taken_at)) {
        matchedLogIndex = i
        break
      }
    }

    if (matchedLogIndex >= 0) {
      // Dose tomada - mover log para takenDoses
      const matchedLog = unmatchedLogs.splice(matchedLogIndex, 1)[0]
      takenDoses.push({
        ...matchedLog,
        scheduledTime: expectedDose.scheduledTime,
        expectedQuantity: expectedDose.expectedQuantity,
        protocol: expectedDose.protocol,
        medicine: expectedDose.medicine,
        status: 'done',
      })
    } else {
      // Dose não tomada - verificar se é perdida (passado) ou agendada (futuro)
      const [scheduledHour, scheduledMinute] = expectedDose.scheduledTime.split(':').map(Number)

      // Construir data/hora agendada com parseLocalDate para timezone consistency
      const scheduledDateTime = parseLocalDate(date)
      scheduledDateTime.setHours(scheduledHour, scheduledMinute, 0, 0)

      // Comparar com horário atual
      const isPast = scheduledDateTime < now

      const baseDose = {
        id: `${isPast ? 'missed' : 'scheduled'}-${expectedDose.protocolId}-${expectedDose.scheduledTime}`,
        protocol_id: expectedDose.protocolId,
        medicine_id: expectedDose.medicineId,
        scheduledTime: expectedDose.scheduledTime,
        expectedQuantity: expectedDose.expectedQuantity,
        quantity_taken: 0,
        protocol: expectedDose.protocol,
        medicine: expectedDose.medicine,
        isSynthetic: true,
      }

      if (isPast) {
        // Dose perdida - horário já passou
        missedDoses.push({
          ...baseDose,
          status: 'missed',
        })
      } else {
        // Dose agendada - horário ainda não chegou
        scheduledDoses.push({
          ...baseDose,
          status: 'scheduled',
        })
      }
    }
  })

  // Logs restantes que não correspondem a nenhuma dose esperada
  // (doses extras, fora do horário, etc.) - adicionar como takenDoses
  unmatchedLogs.forEach((log) => {
    const protocol = protocols.find((p: AdherenceProtocol) => p.id === log.protocol_id)
    takenDoses.push({
      ...log,
      scheduledTime: null,
      expectedQuantity: log.quantity_taken || 1,
      isExtra: true,
      protocol: protocol || null,
      medicine: protocol?.medicine || null,
      status: 'done',
    })
  })

  return { takenDoses, missedDoses, scheduledDoses }
}

/**
 * Avalia o estado tático de uma dose na linha do tempo (Epic 2 Fase 8)
 * Classifica doses em 5 estados: TOMADA, ATRASADA, PERDIDA, PROXIMA, PLANEJADA.
 * 
 * @param {string} date - Data de referência YYYY-MM-DD
 * @param {Object} dosesObj - Retorno de calculateDosesByDate { takenDoses, missedDoses, scheduledDoses }
 * @param {Date} now - Hora atual de referência
 * @returns {Array} Array único e ordenado de doses com a propriedade timelineStatus
 */
export function evaluateDoseTimelineState(
  date: string,
  dosesObj: { takenDoses?: DoseRecord[]; missedDoses?: DoseRecord[]; scheduledDoses?: DoseRecord[] },
  now: Date = getNow()
): DoseRecord[] {
  const { takenDoses = [], missedDoses = [], scheduledDoses = [] } = dosesObj
  const nowMs = now.getTime()

  // Helper para criar Date consistente
  const createScheduledDate = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    const d = parseLocalDate(date)
    d.setHours(h, m, 0, 0)
    return d
  }

  const allDoses = [
    // 1. TOMADAS (Independente do horário)
    ...takenDoses.map((d: DoseRecord) => ({ ...d, timelineStatus: 'TOMADA', isRegistered: true })),

    // 2. MISSES (No passado)
    ...missedDoses.map((d: DoseRecord) => {
      const scheduledDate = createScheduledDate(d.scheduledTime ?? '00:00')
      const diffMs = nowMs - scheduledDate.getTime()

      // Se passou menos de 2h do horário agendado, ainda é ATRASADA
      // Se passou mais de 2h, é PERDIDA
      const timelineStatus = diffMs <= TOLERANCE_WINDOW_MS ? 'ATRASADA' : 'PERDIDA'
      return { ...d, timelineStatus, isRegistered: false }
    }),

    // 3. SCHEDULED (No futuro)
    ...scheduledDoses.map((d: DoseRecord) => {
      const scheduledDate = createScheduledDate(d.scheduledTime ?? '00:00')
      const diffMs = scheduledDate.getTime() - nowMs

      // Se falta menos de 2h para o horário agendado, é PROXIMA (Aviso prévio)
      // Se falta mais de 2h, é PLANEJADA
      const timelineStatus = diffMs <= TOLERANCE_WINDOW_MS ? 'PROXIMA' : 'PLANEJADA'
      return { ...d, timelineStatus, isRegistered: false }
    }),
  ]

  // Ordenar por horário agendado (cronológico)
  return allDoses.sort((a, b) => {
    const getTime = (d: DoseRecord) => d.scheduledTime || (d.taken_at ? parseISO(d.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '00:00')
    return getTime(a).localeCompare(getTime(b))
  })
}

// Mapa de dias da semana para cálculo de frequência semanal
const WEEKLY_DAY_MAP = {
  domingo: 0, sunday: 0,
  segunda: 1, 'segunda-feira': 1, monday: 1,
  terça: 2, 'terça-feira': 2, tuesday: 2,
  quarta: 3, 'quarta-feira': 3, wednesday: 3,
  quinta: 4, 'quinta-feira': 4, thursday: 4,
  sexta: 5, 'sexta-feira': 5, friday: 5,
  sábado: 6, sabado: 6, saturday: 6,
}

/**
 * Obtém os dias ativos do protocolo de forma retrocompatível,
 * tratando corretamente o fato de que arrays vazios '[]' em JS são truthy.
 * @param {Object} protocol - O objeto do protocolo
 * @returns {string[]} Array com os dias da semana ativos
 */
export function getProtocolDays(protocol: AdherenceProtocol | null | undefined): string[] {
  if (!protocol) return []
  if (Array.isArray(protocol.weekdays) && protocol.weekdays.length > 0) {
    return protocol.weekdays
  }
  if (Array.isArray(protocol.days) && protocol.days.length > 0) {
    return protocol.days
  }
  return []
}

/**
 * Verifica se o protocolo semanal tem dose no dia da semana especificado.
 * @param {Object} protocol - Protocolo com propriedade days[]
 * @param {number} dayOfWeek - Dia da semana (0=Domingo, 6=Sábado)
 * @returns {boolean}
 */
function _isWeeklyMatch(protocol: AdherenceProtocol, dayOfWeek: number): boolean {
  const daysArray = getProtocolDays(protocol)
  if (!daysArray || !Array.isArray(daysArray)) return false
  return daysArray.some((day: string) => WEEKLY_DAY_MAP[day.toLowerCase() as keyof typeof WEEKLY_DAY_MAP] === dayOfWeek)
}


/**
 * Verifica se protocolo "dia sim, dia não" tem dose na data alvo.
 * @param {Object} protocol - Protocolo com start_date opcional
 * @param {Date} targetDate - Data alvo
 * @returns {boolean}
 */
function _isAlternatingMatch(protocol: AdherenceProtocol, targetDate: Date): boolean {
  if (!protocol.start_date) return true // Sem data de início, assume início hoje
  const startDate = parseLocalDate(protocol.start_date)
  return daysDifference(startDate, targetDate) % 2 === 0
}

/**
 * Verifica se um protocolo inativo tem registro histórico válido para a data.
 * @param {Object} protocol - Protocolo
 * @param {Date} targetDate - Data alvo
 * @returns {boolean}
 */
function _isHistoricalActive(protocol: AdherenceProtocol, targetDate: Date): boolean {
  return Boolean(protocol.end_date && targetDate <= parseLocalDate(protocol.end_date))
}

/**
 * Verifica se um protocolo está "vigente" para uma data específica.
 * Vigente significa:
 * 1. O protocolo está marcado como ativo
 * 2. A data alvo está dentro do intervalo [start_date, end_date]
 * 3. A frequência do protocolo (diário, semanal, dia-sim-dia-nao) cai na data alvo
 *
 * @param {Object} protocol - Protocolo
 * @param {string|Date} date - Data alvo (YYYY-MM-DD ou Date object)
 * @returns {boolean}
 */
export function isProtocolActiveOnDate(protocol: AdherenceProtocol, date: string | Date): boolean {
  const dateStr = typeof date === 'string' ? date : formatLocalDate(date)
  const targetDate = parseLocalDate(dateStr)
  const dayOfWeek = targetDate.getDay() // 0=Domingo, 1=Segunda, etc.

  // 1. Verificar se o registro está ativo ou se é um registro histórico finalizado
  if (protocol.active === false && !_isHistoricalActive(protocol, targetDate)) return false

  // 2. Verificar período de validade (Usa isProtocolInPeriod do dateUtils)
  if (!isProtocolInPeriod(protocol, dateStr)) return false

  // 3. Verificar frequência
  const frequency = (protocol.frequency || 'diário').toLowerCase()
  return _matchesFrequency(frequency, protocol, dayOfWeek, targetDate)
}

/** @type {Map<string, (protocol: Object, dayOfWeek: number, targetDate: Date) => boolean>} */
const FREQUENCY_MATCHERS = new Map<string, (protocol: AdherenceProtocol, dayOfWeek: number, targetDate: Date) => boolean>([
  ['diário', () => true],
  ['diariamente', () => true],
  ['daily', () => true],
  ['semanal', (protocol, dayOfWeek) => _isWeeklyMatch(protocol, dayOfWeek)],
  ['semanalmente', (protocol, dayOfWeek) => _isWeeklyMatch(protocol, dayOfWeek)],
  ['weekly', (protocol, dayOfWeek) => _isWeeklyMatch(protocol, dayOfWeek)],
  ['dia_sim_dia_nao', (protocol, _dow, targetDate) => _isAlternatingMatch(protocol, targetDate)],
  ['dia sim, dia não', (protocol, _dow, targetDate) => _isAlternatingMatch(protocol, targetDate)],
  ['every_other_day', (protocol, _dow, targetDate) => _isAlternatingMatch(protocol, targetDate)],
  ['alternating', (protocol, _dow, targetDate) => _isAlternatingMatch(protocol, targetDate)],
  ['personalizado', () => false],
  ['custom', () => false],
  ['quando_necessário', () => false],
  ['when_needed', () => false],
  ['prn', () => false],
])

/**
 * Verifica se a frequência do protocolo cobre a data alvo.
 * Extraído de isProtocolActiveOnDate para reduzir complexidade ciclomática.
 * @param {string} frequency - Frequência normalizada (lowercase)
 * @param {Object} protocol - Protocolo
 * @param {number} dayOfWeek - Dia da semana da data alvo
 * @param {Date} targetDate - Data alvo
 * @returns {boolean}
 */
function _matchesFrequency(frequency: string, protocol: AdherenceProtocol, dayOfWeek: number, targetDate: Date): boolean {
  const matcher = FREQUENCY_MATCHERS.get(frequency)
  if (matcher) return matcher(protocol, dayOfWeek, targetDate)
  return true // default: assume ativo
}

// ============================================================================
// Leitura de adesão a partir de ocorrências materializadas (Fase 3 — ADR-048/050/052)
//
// A adesão deixa de ser INFERIDA (casamento ±2h sobre logs + expected calculado)
// e passa a ser CONSULTADA das `dose_instances`, onde cada ocorrência já carrega
// a verdade: `taken` (elo a um log), `missed` (passou da tolerância), `pending`
// (futura/na janela), `skipped_*` (neutro — pausa/skip consciente não penaliza).
//
// Seam A (ADR-052): somas em `dosage_unit`, NUNCA comprimidos.
// Seam B (ADR-052): modo por protocolo — `binary` (default) vs `dose_exactness`.
// Seam C (ADR-052): leitura NÃO valida contra o cap Zod 100 (pill-specific, R-022).
// ============================================================================

/** Modos de adesão (Seam B). `binary` = evento (default); `dose_exactness` = opt-in. */
export const ADHERENCE_MODE = Object.freeze({
  BINARY: 'binary',
  DOSE_EXACTNESS: 'dose_exactness',
})

/** Status de `dose_instances`. `skipped_*` nunca entram no denominador de adesão. */
export const INSTANCE_STATUS = Object.freeze({
  TAKEN: 'taken',
  MISSED: 'missed',
  PENDING: 'pending',
  SKIPPED_PAUSED: 'skipped_paused',
  SKIPPED_USER: 'skipped_user',
})

/** Número finito ou fallback (R-104: `??`/isFinite, nunca `||` — 0 é dose válida). */
function _numOrFallback(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Limita x a [0, 1]. */
function _clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/**
 * Agrega adesão a partir de um conjunto de `dose_instances`.
 *
 * - `binary` (default): `rate = taken / (taken + missed)`. `pending` e `skipped_*`
 *   ficam fora do denominador.
 * - `dose_exactness` (opt-in, Seam B): `rate = Σ aplicado / Σ esperado` sobre as
 *   ocorrências que contam (`taken` + `missed`), com clamp [0,1]. FP-1 (ADR-050):
 *   não exige `aplicado == esperado`. O aplicado vem de `quantity_taken` (enriquecido
 *   pelo elo ao log); ausente numa `taken` → assume o `expected_dose` (dose cheia).
 *
 * Denominador vazio → `rate = null` (não `NaN`/`0`) para o caller distinguir
 * "sem dados" de "0% de adesão".
 *
 * Função PURA: sem I/O, sem mutação dos itens.
 *
 * @param {Array<Object>} instances - linhas de `dose_instances` (status, expected_dose, quantity_taken?)
 * @param {Object} [opts]
 * @param {string} [opts.mode='binary'] - ver ADHERENCE_MODE
 * @returns {{taken:number, missed:number, pending:number, skipped:number, rate:(number|null)}}
 */
function processInstance(inst: DoseInstance, stats: { taken: number; missed: number; pending: number; skipped: number; sumApplied: number; sumExpected: number }): void {
  const status = inst?.status
  const expected = _numOrFallback(inst?.expected_dose, 0)

  switch (status) {
    case INSTANCE_STATUS.TAKEN:
      stats.taken++
      stats.sumApplied += _numOrFallback(inst?.quantity_taken, expected)
      stats.sumExpected += expected
      break
    case INSTANCE_STATUS.MISSED:
      stats.missed++
      stats.sumExpected += expected
      break
    case INSTANCE_STATUS.PENDING:
      stats.pending++
      break
    case INSTANCE_STATUS.SKIPPED_PAUSED:
    case INSTANCE_STATUS.SKIPPED_USER:
      stats.skipped++
      break
  }
}

export function computeAdherenceFromInstances(instances: DoseInstance[] | null | undefined, { mode = ADHERENCE_MODE.BINARY }: { mode?: string } = {}) {
  const list = Array.isArray(instances) ? instances : []

  const stats = {
    taken: 0,
    missed: 0,
    pending: 0,
    skipped: 0,
    sumApplied: 0,
    sumExpected: 0,
  }

  for (const inst of list) {
    processInstance(inst, stats)
  }

  let rate
  if (mode === ADHERENCE_MODE.DOSE_EXACTNESS) {
    rate = stats.sumExpected > 0 ? _clamp01(stats.sumApplied / stats.sumExpected) : null
  } else {
    const denom = stats.taken + stats.missed
    rate = denom > 0 ? stats.taken / denom : null
  }

  return {
    taken: stats.taken,
    missed: stats.missed,
    pending: stats.pending,
    skipped: stats.skipped,
    rate,
  }
}

/**
 * Streak de dias consecutivos sem `missed`, contando de hoje para trás.
 *
 * Limiar de adesão diária (R-022, paridade com a lógica legada `calculateStreaks`):
 * um dia "conta" se tomou ≥80% das doses esperadas (`taken/(taken+missed) >= 0.8`).
 * Não é tolerância zero — quem toma muitas doses/dia e perde uma não vê o streak sumir.
 *
 * Regras:
 * - dia com `expected (taken+missed) == 0` (só `skipped_*` ou sem dose) → NEUTRO;
 * - dia com ratio ≥ `minAdherenceRate` → SOMA;
 * - dia passado com ratio < `minAdherenceRate` → QUEBRA;
 * - HOJE com ratio < limiar → NEUTRO (dia não acabou; não zera o streak — paridade UX legada).
 *
 * Agrupa por dia no fuso do usuário — `scheduled_for` é instante absoluto (ISO/UTC),
 * então a fronteira de dia depende do tz (G1: injeção real do tz fica na F4; default SP).
 * Cross-meia-noite é natural: a ocorrência cai no dia do seu `scheduled_for` no tz.
 *
 * Função PURA.
 *
 * @param {Array<Object>} instances - linhas de `dose_instances` (status, scheduled_for)
 * @param {Object} [opts]
 * @param {string} [opts.tz='America/Sao_Paulo'] - fuso para a fronteira de dia
 * @param {string} [opts.today] - dia de referência "YYYY-MM-DD" (default: hoje no tz)
 * @param {number} [opts.minAdherenceRate=0.8] - fração mínima de doses tomadas no dia
 * @returns {number} dias de streak
 */
export function computeStreakFromInstances(
  instances: DoseInstance[] | null | undefined,
  { tz = 'America/Sao_Paulo', today, minAdherenceRate = 0.8 }: { tz?: string; today?: string; minAdherenceRate?: number } = {}
) {
  const byDay = _buildDayStatusMap(instances, tz)
  const todayKey = today ?? formatLocalDate(getNow(tz))

  // dias conhecidos até hoje, do mais recente para o mais antigo (gaps são neutros).
  const days = [...byDay.keys()].filter((k) => k <= todayKey).sort((a, b) => b.localeCompare(a))

  let streak = 0
  for (const key of days) {
    const entry = byDay.get(key)
    if (!entry) continue
    const expected = entry.taken + entry.missed
    if (expected === 0) continue // dia neutro (skipped-only / sem dose)
    if (entry.taken / expected >= minAdherenceRate) {
      streak++ // dia bem-sucedido (≥ limiar)
    } else if (key === todayKey) {
      continue // hoje ainda não terminou — não quebra
    } else {
      break // dia passado abaixo do limiar quebra o streak
    }
  }
  return streak
}

/**
 * Agrupa instâncias por dia local (tz) → Map<dayKey, {missed, taken}> (CONTAGENS).
 * `scheduled_for` é instante absoluto; o tz só governa a fronteira de dia.
 * @param {Array<Object>} instances
 * @param {string} tz
 * @returns {Map<string, {missed: number, taken: number}>}
 */
function _buildDayStatusMap(instances: DoseInstance[] | null | undefined, tz: string): Map<string, { missed: number; taken: number }> {
  const list = Array.isArray(instances) ? instances : []
  const byDay = new Map()
  for (const inst of list) {
    if (!inst?.scheduled_for) continue
    const dayKey = formatLocalDate(getUserTime(parseISO(inst.scheduled_for), tz))
    let entry = byDay.get(dayKey)
    if (!entry) {
      entry = { missed: 0, taken: 0 }
      byDay.set(dayKey, entry)
    }
    if (inst.status === INSTANCE_STATUS.MISSED) entry.missed++
    else if (inst.status === INSTANCE_STATUS.TAKEN) entry.taken++
  }
  return byDay
}

/**
 * Maior streak histórico: maior sequência de dias com adesão ≥ limiar, varrendo TODO
 * o histórico fornecido. Mesma semântica do streak corrente (≥80% conta, <80% quebra,
 * dia neutro mantém) — mas sem a graça de "hoje" (histórico já fechado).
 *
 * Função PURA.
 *
 * @param {Array<Object>} instances - linhas de `dose_instances` (status, scheduled_for)
 * @param {Object} [opts]
 * @param {string} [opts.tz='America/Sao_Paulo']
 * @param {number} [opts.minAdherenceRate=0.8]
 * @returns {number} maior streak
 */
export function computeLongestStreakFromInstances(
  instances: DoseInstance[] | null | undefined,
  { tz = 'America/Sao_Paulo', minAdherenceRate = 0.8 } = {}
) {
  const byDay = _buildDayStatusMap(instances, tz)
  const days = [...byDay.keys()].sort() // cronológico ascendente

  let longest = 0
  let run = 0
  for (const key of days) {
    const entry = byDay.get(key)
    if (!entry) continue
    const expected = entry.taken + entry.missed
    if (expected === 0) continue // dia neutro: mantém run
    if (entry.taken / expected >= minAdherenceRate) {
      run++ // dia bem-sucedido
      if (run > longest) longest = run
    } else {
      run = 0 // dia abaixo do limiar quebra a sequência
    }
  }
  return longest
}
