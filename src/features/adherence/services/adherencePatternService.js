import { validateAnalyzeAdherencePatternsInput } from '@schemas/adherencePatternSchema'

/**
 * Nomes dos dias da semana
 */
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/**
 * Nomes dos períodos do dia
 */
const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']

/**
 * Períodos do dia em horas (0-6, 6-12, 12-18, 18-24)
 */
const PERIOD_HOURS = [
  { start: 0, end: 6 },   // 0: Madrugada
  { start: 6, end: 12 },  // 1: Manhã
  { start: 12, end: 18 }, // 2: Tarde
  { start: 18, end: 24 }, // 3: Noite
]

/**
 * Determina o índice do período baseado na hora
 * @param {number} hour - Hora (0-23)
 * @returns {number} Índice do período (0-3)
 */
function getPeriodIndex(hour) {
  if (hour < 6) return 0  // Madrugada
  if (hour < 12) return 1 // Manhã
  if (hour < 18) return 2 // Tarde
  return 3                 // Noite
}

/**
 * Conta quantos dias únicos com dados existem nos logs
 * @param {Array} logs - Array de logs de doses
 * @returns {number} Quantidade de dias únicos com dados
 */
function countUniqueDaysWithLogs(logs) {
  const uniqueDays = new Set(
    logs.map((log) => {
      const date = new Date(log.taken_at)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
  )
  return uniqueDays.size
}

/**
 * Pré-processa protocolos para mapear time_schedule por dia da semana
 * Retorna um mapa: { dayIndex: { periodIndex: count } }
 * @param {Array} protocols - Array de protocolos com time_schedule
 * @returns {Object} Mapa de doses esperadas por dia/período
 */
function preprocessProtocolsExpected(protocols) {
  const expectedMap = {}

  // Inicializar grid vazio
  for (let day = 0; day < 7; day++) {
    expectedMap[day] = { 0: 0, 1: 0, 2: 0, 3: 0 }
  }

  // Para cada protocolo, mapear doses esperadas por dia da semana
  protocols.forEach((protocol) => {
    if (!protocol.time_schedule || protocol.time_schedule.length === 0) {
      return
    }

    const daysOfWeek = getDaysOfWeekForProtocol(protocol.frequency)

    daysOfWeek.forEach((dayIndex) => {
      protocol.time_schedule.forEach((timeStr) => {
        const [hour] = timeStr.split(':').map(Number)
        const periodIndex = getPeriodIndex(hour)
        expectedMap[dayIndex][periodIndex] += 1
      })
    })
  })

  return expectedMap
}

/**
 * Retorna dias da semana esperados para um protocolo baseado em frequência
 * @param {string} frequency - Frequência do protocolo
 * @returns {Array<number>} Array de índices de dias (0-6)
 */
function getDaysOfWeekForProtocol(frequency) {
  switch (frequency) {
    case 'diário':
      return [0, 1, 2, 3, 4, 5, 6] // Todos os dias
    case 'dias_alternados':
      return [0, 2, 4, 6] // Padrão: dias pares
    case 'semanal':
      return [0] // Uma vez por semana (domingo)
    case 'quando_necessário':
    case 'personalizado':
      return [] // Não contar doses esperadas para esses casos
    default:
      return []
  }
}

/**
 * Analisa padrões de adesão por dia da semana e período do dia.
 *
 * @param {Object} params
 * @param {Array} params.logs - Logs de doses (mínimo 21 dias recomendado)
 * @param {Array} params.protocols - Protocolos ativos com time_schedule
 * @returns {{
 *   grid: Array<Array<{adherence: number, taken: number, expected: number}>>,
 *   worstCell: { dayIndex: number, periodIndex: number, adherence: number, dayName: string, periodName: string } | null,
 *   narrative: string,
 *   hasEnoughData: boolean
 * }}
 */
export function analyzeAdherencePatterns({ logs, protocols }) {
  // Validar entrada com Zod
  const validation = validateAnalyzeAdherencePatternsInput({ logs, protocols })
  if (!validation.success) {
    throw new Error(`Validação falhou: ${validation.errors.map((e) => e.message).join(', ')}`)
  }

  // Inicializar grid 7x4 com zeros
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 4 }, () => ({ taken: 0, expected: 0, adherence: 0 }))
  )

  // Pré-processar protocolos para obter doses esperadas (por dia da semana)
  const expectedMap = preprocessProtocolsExpected(protocols)

  // Contar doses tomadas por célula
  logs.forEach((log) => {
    const logDate = new Date(log.taken_at)
    const dayIndex = logDate.getDay() // 0-6 (domingo-sábado)
    const hour = logDate.getHours()
    const periodIndex = getPeriodIndex(hour)

    grid[dayIndex][periodIndex].taken += log.quantity_taken
  })

  // Contar quantas vezes cada dia da semana ocorre nos logs
  const dayOccurrences = [0, 0, 0, 0, 0, 0, 0]
  const uniqueDates = new Set()
  logs.forEach((log) => {
    const logDate = new Date(log.taken_at)
    const dateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`
    if (!uniqueDates.has(dateStr)) {
      uniqueDates.add(dateStr)
      const dayIndex = logDate.getDay()
      dayOccurrences[dayIndex] += 1
    }
  })

  // Preencher expected e calcular adherence (normalizado)
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    for (let periodIndex = 0; periodIndex < 4; periodIndex++) {
      const expectedPerDay = expectedMap[dayIndex][periodIndex]
      const occurrences = dayOccurrences[dayIndex]
      const totalExpected = expectedPerDay * occurrences
      const taken = grid[dayIndex][periodIndex].taken

      // Armazenar expected (por dia) no grid
      grid[dayIndex][periodIndex].expected = expectedPerDay

      if (totalExpected > 0) {
        // Calcular adherence normalizando: (taken / totalExpected) * 100
        grid[dayIndex][periodIndex].adherence = Math.min(100, Math.round((taken / totalExpected) * 100))
      } else if (expectedPerDay === 0) {
        // Se não há doses esperadas neste período, marcar como N/D
        grid[dayIndex][periodIndex].adherence = null
      } else if (occurrences === 0) {
        // Se o dia não ocorre nos logs, não calcular adherence
        grid[dayIndex][periodIndex].adherence = null
      }
    }
  }

  // Contar dias únicos com dados
  const daysWithData = countUniqueDaysWithLogs(logs)
  const hasEnoughData = daysWithData >= 21

  // Encontrar pior célula (mínimo 3 doses esperadas)
  let worstCell = null
  if (hasEnoughData) {
    let worstAdherence = 100
    let worstDayIndex = null
    let worstPeriodIndex = null

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      for (let periodIndex = 0; periodIndex < 4; periodIndex++) {
        const cell = grid[dayIndex][periodIndex]
        if (cell.expected >= 3 && cell.adherence < worstAdherence) {
          worstAdherence = cell.adherence
          worstDayIndex = dayIndex
          worstPeriodIndex = periodIndex
        }
      }
    }

    if (worstDayIndex !== null && worstPeriodIndex !== null) {
      worstCell = {
        dayIndex: worstDayIndex,
        periodIndex: worstPeriodIndex,
        adherence: worstAdherence,
        dayName: DAY_NAMES[worstDayIndex],
        periodName: PERIOD_NAMES[worstPeriodIndex],
      }
    }
  }

  // Gerar narrativa
  let narrative = ''
  if (hasEnoughData && worstCell) {
    narrative = `Seu pior horário é ${worstCell.dayName} à ${worstCell.periodName.toLowerCase()}`
  } else if (!hasEnoughData) {
    narrative = `Dados insuficientes. Registre pelo menos 21 dias de doses para análise completa.`
  } else {
    narrative = 'Sua adesão está excelente em todos os períodos!'
  }

  return {
    grid,
    worstCell: hasEnoughData ? worstCell : null,
    narrative,
    hasEnoughData,
  }
}

export default analyzeAdherencePatterns
