/**
 * Adherence Logic - Funções puras para cálculo de adesão client-side
 *
 * Migrado de adherenceService para suportar "Custo Zero" de queries.
 * @module adherenceLogic
 */

import { 
  parseLocalDate, 
  formatLocalDate, 
  getTodayLocal, 
  isProtocolActiveOnDate as isProtocolInPeriod,
  getNow,
  parseISO,
  daysDifference,
  getSaoPauloTime,
  cloneDate
} from './dateUtils.js'

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
/**
 * Calcula a taxa de doses diárias de um protocolo conforme sua frequência
 * @param {string} frequency - Frequência do protocolo (daily, weekly, every_other_day, etc.)
 * @param {number} timesPerDay - Número de horários no time_schedule
 * @returns {number} Taxa de doses por dia
 */
function getDailyDoseRate(frequency, timesPerDay) {
  switch (frequency.toLowerCase()) {
    case 'daily':
    case 'diariamente':
    case 'diário':
      return timesPerDay
    case 'weekly':
    case 'semanal':
    case 'semanalmente':
      return timesPerDay / 7
    case 'every_other_day':
    case 'dia_sim_dia_nao':
    case 'dia sim, dia não':
    case 'dias_alternados':
      return timesPerDay / 2
    case 'quando_necessário':
    case 'personalizado':
      return 0
    default:
      return timesPerDay
  }
}

/**
 * Calcula o número de dias efetivos de um protocolo dentro de um período de análise
 * @param {Object} protocol - Protocolo com start_date e end_date opcionais
 * @param {Date} periodStart - Início do período de análise
 * @param {Date} periodEnd - Fim do período de análise
 * @returns {number} Número de dias efetivos (interseção entre protocolo e período)
 */
function getEffectiveDays(protocol, periodStart, periodEnd) {
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

export function calculateExpectedDoses(protocols, days, endDate = getNow()) {
  if (!protocols || protocols.length === 0) return 0

  const periodStart = cloneDate(endDate)
  periodStart.setHours(0, 0, 0, 0)
  periodStart.setDate(periodStart.getDate() - days + 1)

  const periodEnd = cloneDate(endDate)
  periodEnd.setHours(23, 59, 59, 999)

  return protocols.reduce((total, protocol) => {
    const timesPerDay = protocol.time_schedule?.length || 1
    const frequency = protocol.frequency || 'daily'
    const dailyDoses = getDailyDoseRate(frequency, timesPerDay)
    const effectiveDays = getEffectiveDays(protocol, periodStart, periodEnd)
    return total + dailyDoses * Math.max(effectiveDays, 0)
  }, 0)
}

/**
 * Calcula o streak e score baseado em logs e protocolos em memória
 * @param {Array} logs
 * @param {Array} protocols
 * @param {number} days
 * @returns {Object}
 */
export function calculateAdherenceStats(logs, protocols, days = 30, offsetDays = 0) {
  const logsByDay = new Map()
  logs.forEach((log) => {
    const dayKey = formatLocalDate(getSaoPauloTime(parseISO(log.taken_at)))
    if (!logsByDay.has(dayKey)) logsByDay.set(dayKey, [])
    logsByDay.get(dayKey).push(log)
  })

  let totalExpected = 0
  let totalFollowed = 0
  let totalTakenAnytime = 0
  let currentStreak = 0
  let streakBroken = false
  const todayStr = getTodayLocal()

  // Loop expandido para cobrir o streak além dos dias do score
  // Limite de segurança de 365 dias para evitar loops infinitos em datasets mal formados
  const maxDays = Math.max(days + offsetDays, 365)

  for (let i = offsetDays; i < maxDays; i++) {
    const date = getNow()
    date.setDate(date.getDate() - i)
    const dateStr = formatLocalDate(date)
    const dayLogs = logsByDay.get(dateStr) || []

    let dayExpected = 0
    let dayFollowed = 0
    let dayTakenAnytime = 0

    protocols.forEach((protocol) => {
      // Verificar se o protocolo estava ativo nesta data
      if (!isProtocolActiveOnDate(protocol, dateStr)) return

      const times = protocol.time_schedule || []
      dayExpected += times.length

      // Doses tomadas para este protocolo específico neste dia (independente de horário)
      const protocolLogs = dayLogs.filter((l) => l.protocol_id === protocol.id)
      dayTakenAnytime += Math.min(protocolLogs.length, times.length)

      times.forEach((time) => {
        if (isProtocolFollowed(time, dayLogs, dateStr)) {
          dayFollowed++
        }
      })
    })

    // Acumula para o score apenas se estiver dentro da janela 'days'
    if (i < offsetDays + days) {
      totalExpected += dayExpected
      totalFollowed += dayFollowed
      totalTakenAnytime += dayTakenAnytime
    }

    // Lógica de Streak (continua enquanto não quebrar)
    if (!streakBroken) {
      const minAdherence = 0.8
      // Para o STREAK, somos mais permissivos:
      // 1. Se não havia nada previsto (gap entre tratamentos), o streak não quebra (mantém vivo)
      // 2. Se havia doses, basta ter tomado (anytime) 80% delas (R-022)
      const isDaySuccessful = dayExpected === 0 || dayTakenAnytime / dayExpected >= minAdherence
      const isToday = dateStr === todayStr

      if (isDaySuccessful) {
        currentStreak++
      } else if (isToday) {
        // Hoje ainda não terminou, mantemos o streak vivo por UX positiva
      } else if (dayExpected > 0) {
        // Dia com doses esperadas que falhou (mesmo considerando anytime): quebra o streak
        streakBroken = true
      }
      // Se dayExpected == 0, o streak continua (dia de folga/sem protocolo)
    }

    // Se já calculamos o score E o streak quebrou, podemos parar
    if (i >= offsetDays + days && streakBroken) break
  }

  const score =
    totalExpected > 0 ? Math.min(Math.round((totalFollowed / totalExpected) * 100), 100) : 0

  return {
    score,
    taken: totalFollowed,
    takenAnytime: totalTakenAnytime,
    expected: totalExpected,
    currentStreak,
  }
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
export function isProtocolFollowed(scheduledTime, logs, dateStr) {
  if (!scheduledTime || !logs || logs.length === 0) return false

  return logs.some((log) => {
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
export function isDoseInToleranceWindow(scheduledTime, logTakenAt) {
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
export function getNextDoseTime(protocol) {
  if (!protocol || !protocol.time_schedule || protocol.time_schedule.length === 0) {
    return '--:--'
  }

  const now = getNow()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Converte horários do cronograma para minutos e ordena
  const scheduleMinutes = protocol.time_schedule
    .map((time) => {
      const [h, m] = time.split(':').map(Number)
      return h * 60 + m
    })
    .sort((a, b) => a - b)

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
export function getNextDoseWindowEnd(nextDoseTime) {
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
export function isInToleranceWindow(nextDoseTime) {
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
export function calculateDailyIntake(medicineId, protocols) {
  if (!protocols) return 0

  return protocols
    .filter((p) => p.medicine_id === medicineId && p.active)
    .reduce((total, p) => {
      const dosesPerDay = p.time_schedule?.length || 1
      const dosage = p.dosage_per_intake || 1
      return total + dosesPerDay * dosage
    }, 0)
}

/**
 * Calcula dias restantes de estoque
 * @param {number} totalQuantity
 * @param {number} dailyIntake
 * @returns {number}
 */
export function calculateDaysRemaining(totalQuantity, dailyIntake) {
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
export function calculateDosesByDate(date, logs, protocols, now = getNow()) {
  if (!date || !protocols || protocols.length === 0) {
    return { takenDoses: [], missedDoses: [], scheduledDoses: [] }
  }

  const takenDoses = []
  const missedDoses = []
  const scheduledDoses = []

  // Filtrar protocolos aplicáveis para esta data
  const applicableProtocols = protocols.filter((p) => isProtocolActiveOnDate(p, date))

  // Gerar slots de doses esperados para cada protocolo aplicável
  const expectedDoses = []
  applicableProtocols.forEach((protocol) => {
    const schedule = protocol.time_schedule || []
    schedule.forEach((time) => {
      expectedDoses.push({
        protocolId: protocol.id,
        medicineId: protocol.medicine_id,
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
    const protocol = protocols.find((p) => p.id === log.protocol_id)
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
export function evaluateDoseTimelineState(date, dosesObj, now = getNow()) {
  const { takenDoses = [], missedDoses = [], scheduledDoses = [] } = dosesObj
  const nowMs = now.getTime()

  // Helper para criar Date consistente
  const createScheduledDate = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number)
    const d = parseLocalDate(date)
    d.setHours(h, m, 0, 0)
    return d
  }

  const allDoses = [
    // 1. TOMADAS (Independente do horário)
    ...takenDoses.map((d) => ({ ...d, timelineStatus: 'TOMADA', isRegistered: true })),

    // 2. MISSES (No passado)
    ...missedDoses.map((d) => {
      const scheduledDate = createScheduledDate(d.scheduledTime)
      const diffMs = nowMs - scheduledDate.getTime()

      // Se passou menos de 2h do horário agendado, ainda é ATRASADA
      // Se passou mais de 2h, é PERDIDA
      const timelineStatus = diffMs <= TOLERANCE_WINDOW_MS ? 'ATRASADA' : 'PERDIDA'
      return { ...d, timelineStatus, isRegistered: false }
    }),

    // 3. SCHEDULED (No futuro)
    ...scheduledDoses.map((d) => {
      const scheduledDate = createScheduledDate(d.scheduledTime)
      const diffMs = scheduledDate.getTime() - nowMs

      // Se falta menos de 2h para o horário agendado, é PROXIMA (Aviso prévio)
      // Se falta mais de 2h, é PLANEJADA
      const timelineStatus = diffMs <= TOLERANCE_WINDOW_MS ? 'PROXIMA' : 'PLANEJADA'
      return { ...d, timelineStatus, isRegistered: false }
    }),
  ]

  // Ordenar por horário agendado (cronológico)
  return allDoses.sort((a, b) => {
    const getTime = (d) => d.scheduledTime || (d.taken_at ? parseISO(d.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '00:00')
    return getTime(a).localeCompare(getTime(b))
  })
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
export function isProtocolActiveOnDate(protocol, date) {
  const dateStr = typeof date === 'string' ? date : formatLocalDate(date)
  const targetDate = parseLocalDate(dateStr)
  const dayOfWeek = targetDate.getDay() // 0=Domingo, 1=Segunda, etc.

  // 1. Verificar se o registro está ativo ou se é um registro histórico finalizado (histórico de adesão)
  const isHistorical = protocol.end_date && targetDate <= parseLocalDate(protocol.end_date)
  if (protocol.active === false && !isHistorical) return false

  // 2. Verificar período de validade (Usa isProtocolInPeriod do dateUtils)
  if (!isProtocolInPeriod(protocol, dateStr)) return false

  // 3. Verificar frequência
  const frequency = (protocol.frequency || 'diário').toLowerCase()

  switch (frequency) {
    case 'diário':
    case 'diariamente':
    case 'daily':
      return true

    case 'semanal':
    case 'semanalmente':
    case 'weekly':
      // Verificar se o dia da semana está nos dias configurados
      if (protocol.days && Array.isArray(protocol.days)) {
        const dayMap = {
          domingo: 0, sunday: 0,
          segunda: 1, 'segunda-feira': 1, monday: 1,
          terça: 2, 'terça-feira': 2, tuesday: 2,
          quarta: 3, 'quarta-feira': 3, wednesday: 3,
          quinta: 4, 'quinta-feira': 4, thursday: 4,
          sexta: 5, 'sexta-feira': 5, friday: 5,
          sábado: 6, sabado: 6, saturday: 6,
        }
        return protocol.days.some((day) => dayMap[day.toLowerCase()] === dayOfWeek)
      }
      return false

    case 'dia_sim_dia_nao':
    case 'dia sim, dia não':
    case 'every_other_day':
    case 'alternating':
      // Calcular dias desde a data de início (dia 0 = dose)
      if (protocol.start_date) {
        const startDate = parseLocalDate(protocol.start_date)
        return daysDifference(startDate, targetDate) % 2 === 0
      }
      return true // Sem data de início, assume início hoje

    case 'personalizado':
    case 'custom':
    case 'quando_necessário':
    case 'when_needed':
    case 'prn':
      return false

    default:
      return true
  }
}
