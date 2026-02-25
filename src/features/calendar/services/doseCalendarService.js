/**
 * Dose Calendar Service - Cálculo de mapa mensal de doses
 *
 * Serviço para calcular o status de doses diárias para exibição em calendário visual.
 * Todas as funções são puras e não fazem chamadas de API.
 *
 * @module doseCalendarService
 */

import { parseLocalDate, formatLocalDate, isProtocolActiveOnDate } from '@utils/dateUtils'
import { isDoseInToleranceWindow } from '@utils/adherenceLogic'

/**
 * Status possíveis para um dia no calendário de doses.
 * @typedef {'completo' | 'parcial' | 'perdido' | 'sem_doses'} DayStatus
 */

/**
 * Mapa diário de doses com contagem e status.
 * @typedef {Object} DailyDoseInfo
 * @property {number} expected - Total de doses esperadas no dia
 * @property {number} taken - Total de doses tomadas no dia
 * @property {DayStatus} status - Status do dia
 */

/**
 * Mapa mensal de doses indexado por data (YYYY-MM-DD).
 * @typedef {Object.<string, DailyDoseInfo>} MonthlyDoseMap
 */

/**
 * Calcula o número de dias em um mês.
 *
 * @param {number} year - Ano (ex: 2026)
 * @param {number} month - Mês (1-12, onde 1 é Janeiro)
 * @returns {number} Número de dias no mês
 */
function getDaysInMonth(year, month) {
  // month é 1-indexado, então criamos data do dia 0 do próximo mês
  return new Date(year, month, 0).getDate()
}

/**
 * Verifica se um protocolo deve gerar doses esperadas em uma data específica.
 * Considera frequência, dias alternados, semanal, etc.
 *
 * @param {Object} protocol - Protocolo a verificar
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {boolean} True se o protocolo deve gerar doses na data
 */
function shouldExpectDosesOnDate(protocol, dateStr) {
  // Protocolos inativos não geram doses esperadas
  if (!protocol.active) return false

  // Verificar se está dentro do período de vigência
  if (!isProtocolActiveOnDate(protocol, dateStr)) return false

  const frequency = (protocol.frequency || 'diário').toLowerCase()

  // "Quando necessário" não gera doses esperadas
  if (
    frequency === 'quando_necessário' ||
    frequency === 'when_needed' ||
    frequency === 'prn'
  ) {
    return false
  }

  const targetDate = parseLocalDate(dateStr)
  const dayOfWeek = targetDate.getDay() // 0=Domingo, 1=Segunda, etc.

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
          domingo: 0,
          sunday: 0,
          segunda: 1,
          'segunda-feira': 1,
          monday: 1,
          terça: 2,
          'terça-feira': 2,
          tuesday: 2,
          quarta: 3,
          'quarta-feira': 3,
          wednesday: 3,
          quinta: 4,
          'quinta-feira': 4,
          thursday: 4,
          sexta: 5,
          'sexta-feira': 5,
          friday: 5,
          sábado: 6,
          sabado: 6,
          saturday: 6,
        }
        return protocol.days.some((day) => dayMap[day.toLowerCase()] === dayOfWeek)
      }
      return false

    case 'dias_alternados':
    case 'dia_sim_dia_nao':
    case 'dia sim, dia não':
    case 'every_other_day':
    case 'alternating':
      // Calcular dias desde a data de início
      if (protocol.start_date) {
        const startDate = parseLocalDate(protocol.start_date)
        const diffTime = targetDate.getTime() - startDate.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        // Dia sim, dia não: dias pares = dose, ímpares = sem dose
        return diffDays % 2 === 0
      }
      // Se não tiver data de início, assumir que começa hoje (dia 0 = dose)
      return true

    case 'personalizado':
    case 'custom':
      // Frequência personalizada requer lógica específica não definida
      return false

    default:
      return true
  }
}

/**
 * Conta quantas doses esperadas um protocolo tem em uma data.
 *
 * @param {Object} protocol - Protocolo a verificar
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {number} Número de doses esperadas
 */
function countExpectedDosesForDate(protocol, dateStr) {
  if (!shouldExpectDosesOnDate(protocol, dateStr)) return 0

  // Número de horários no time_schedule
  const schedule = protocol.time_schedule || []
  return schedule.length
}

/**
 * Conta quantas doses foram tomadas em uma data para um protocolo específico.
 * Considera a janela de tolerância de 2 horas.
 *
 * @param {Array} logs - Lista de logs de medicamentos
 * @param {string} protocolId - ID do protocolo
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @param {Array} timeSchedule - Array de horários esperados (strings HH:mm)
 * @returns {number} Número de doses tomadas dentro da tolerância
 */
function countTakenDosesForDate(logs, protocolId, dateStr, timeSchedule) {
  if (!logs || logs.length === 0) return 0

  // Filtrar logs do protocolo e da data
  const relevantLogs = logs.filter((log) => {
    if (log.protocol_id !== protocolId) return false

    // Extrair data local do log
    const logDate = new Date(log.taken_at)
    const logDateStr = formatLocalDate(logDate)

    return logDateStr === dateStr
  })

  if (relevantLogs.length === 0) return 0
  if (!timeSchedule || timeSchedule.length === 0) return relevantLogs.length

  // Para cada horário esperado, verificar se há um log dentro da tolerância
  let takenCount = 0
  const unmatchedLogs = [...relevantLogs]

  timeSchedule.forEach((scheduledTime) => {
    const matchedIndex = unmatchedLogs.findIndex((log) =>
      isDoseInToleranceWindow(scheduledTime, log.taken_at)
    )

    if (matchedIndex >= 0) {
      takenCount++
      unmatchedLogs.splice(matchedIndex, 1)
    }
  })

  // Logs extras (fora dos horários esperados) também contam como tomados
  takenCount += unmatchedLogs.length

  return takenCount
}

/**
 * Determina o status do dia baseado nas doses esperadas e tomadas.
 *
 * @param {number} expected - Total de doses esperadas
 * @param {number} taken - Total de doses tomadas
 * @returns {DayStatus} Status do dia
 */
function determineDayStatus(expected, taken) {
  if (expected === 0) return 'sem_doses'
  if (taken === expected) return 'completo'
  if (taken > 0 && taken < expected) return 'parcial'
  // expected > 0 && taken === 0
  return 'perdido'
}

/**
 * Calcula o mapa mensal de doses para exibição em calendário visual.
 *
 * Esta função pura processa logs e protocolos para gerar um mapa
 * indexado por data com contagem de doses esperadas, tomadas e status.
 *
 * @param {Array} logs - Lista de logs de medicamentos (do logService)
 * @param {Array} protocols - Lista de protocolos ativos (do protocolService)
 * @param {number} year - Ano do período (ex: 2026)
 * @param {number} month - Mês do período (1-12, onde 1 é Janeiro)
 * @returns {MonthlyDoseMap} Mapa de doses por data
 *
 * @example
 * const logs = await logService.getByMonth(2026, 1)
 * const protocols = await protocolService.getActive()
 * const doseMap = calculateMonthlyDoseMap(logs.data, protocols, 2026, 2)
 * // Retorna: { '2026-02-01': { expected: 2, taken: 2, status: 'completo' }, ... }
 */
export function calculateMonthlyDoseMap(logs, protocols, year, month) {
  const doseMap = {}
  const daysInMonth = getDaysInMonth(year, month)

  // Inicializar mapa com todos os dias do mês
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    doseMap[dateStr] = {
      expected: 0,
      taken: 0,
      status: 'sem_doses',
    }
  }

  // Se não há protocolos, retornar mapa vazio
  if (!protocols || protocols.length === 0) {
    return doseMap
  }

  // Processar cada dia do mês
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    let dayExpected = 0
    let dayTaken = 0

    // Processar cada protocolo
    protocols.forEach((protocol) => {
      const expectedForProtocol = countExpectedDosesForDate(protocol, dateStr)
      dayExpected += expectedForProtocol

      if (expectedForProtocol > 0) {
        const takenForProtocol = countTakenDosesForDate(
          logs || [],
          protocol.id,
          dateStr,
          protocol.time_schedule
        )
        dayTaken += takenForProtocol
      }
    })

    // Determinar status do dia
    const status = determineDayStatus(dayExpected, dayTaken)

    doseMap[dateStr] = {
      expected: dayExpected,
      taken: dayTaken,
      status,
    }
  }

  return doseMap
}

/**
 * Calcula estatísticas resumidas do mês.
 *
 * @param {MonthlyDoseMap} doseMap - Mapa de doses calculado
 * @returns {Object} Estatísticas do mês
 * @returns {number} returns.totalExpected - Total de doses esperadas no mês
 * @returns {number} returns.totalTaken - Total de doses tomadas no mês
 * @returns {number} returns.completeDays - Dias com status 'completo'
 * @returns {number} returns.partialDays - Dias com status 'parcial'
 * @returns {number} returns.missedDays - Dias com status 'perdido'
 * @returns {number} returns.adherenceRate - Taxa de adesão (0-100)
 */
export function calculateMonthlyStats(doseMap) {
  let totalExpected = 0
  let totalTaken = 0
  let completeDays = 0
  let partialDays = 0
  let missedDays = 0

  Object.values(doseMap).forEach((dayInfo) => {
    totalExpected += dayInfo.expected
    totalTaken += dayInfo.taken

    switch (dayInfo.status) {
      case 'completo':
        completeDays++
        break
      case 'parcial':
        partialDays++
        break
      case 'perdido':
        missedDays++
        break
    }
  })

  const adherenceRate = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0

  return {
    totalExpected,
    totalTaken,
    completeDays,
    partialDays,
    missedDays,
    adherenceRate,
  }
}
