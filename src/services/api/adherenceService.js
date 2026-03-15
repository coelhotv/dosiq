import { z } from 'zod'
import { supabase, getUserId } from '@shared/utils/supabase'
import { isProtocolActiveOnDate, parseLocalDate, formatLocalDate } from '@utils/dateUtils.js'

// Schema para validação de parâmetros
const GetDailyAdherenceFromViewSchema = z.object({
  days: z.number().int().positive().max(365, 'Máximo 365 dias').default(30),
})

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']

/**
 * Extrai intervalo de datas baseado em um período string
 * @param {string} period - Período: '7d', '30d', '90d'
 * @returns {{days: number, endDate: Date, startDate: Date}}
 */
function _getDateRangeForPeriod(period) {
  const days = parseInt(period)
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - days)
  return { startDate, endDate, days }
}

/**
 * Inicializa e preenche o grid de adesão 7×4 com os dados fornecidos
 * @param {Array} data - Dados brutos da view de heatmap
 * @returns {Array<Array<Object>>} O grid de adesão 7×4
 */
function buildAdherenceGrid(data) {
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 4 }, () => ({ taken: 0, expected: 0, adherence: null }))
  )

  ;(data || []).forEach((row) => {
    grid[row.day_of_week][row.period_index] = {
      taken: row.taken_doses,
      expected: row.expected_doses,
      adherence: row.adherence_percentage,
    }
  })

  return grid
}

/**
 * Encontra pior célula e gera narrativa para heatmap
 * @param {Array} data - Dados do heatmap
 * @param {boolean} hasEnoughData - Se tem dados suficientes
 * @returns {object} {worstCell, narrative}
 */
function buildHeatmapNarrative(data, hasEnoughData) {
  let worstCell = null

  if (hasEnoughData) {
    let worstAdherence = 100
    let worstDayIndex = null
    let worstPeriodIndex = null

    ;(data || []).forEach((row) => {
      if (
        row.expected_doses >= 3 &&
        row.adherence_percentage !== null &&
        row.adherence_percentage < worstAdherence
      ) {
        worstAdherence = row.adherence_percentage
        worstDayIndex = row.day_of_week
        worstPeriodIndex = row.period_index
      }
    })

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

  const narrative =
    hasEnoughData && worstCell
      ? `Seu pior horário é ${worstCell.dayName} à ${worstCell.periodName.toLowerCase()}`
      : !hasEnoughData
        ? `Dados insuficientes. Registre pelo menos 21 dias de doses para análise completa.`
        : 'Sua adesão está excelente em todos os períodos!'

  return { worstCell, narrative }
}

/**
 * Adherence Service - Cálculo de adesão ao tratamento
 *
 * CÁLCULOS PRINCIPAIS:
 * - Adesão = (Doses Registradas / Doses Esperadas) × 100
 * - Doses Esperadas = Soma das frequências dos protocolos no período
 * - Doses Registradas = Logs confirmados no período
 * - Streak = Dias seguidos com adesão >= 80%
 *
 * @module adherenceService
 */
export const adherenceService = {
  /**
   * Calcula o score de adesão geral do usuário
   * @param {string} period - Período: '7d', '30d', '90d'
   * @param {string} [userId] - ID do usuário (opcional, evita chamadas redundantes ao getUser)
   * @returns {Promise<{score: number, taken: number, expected: number, period: string}>}
   */
  async calculateAdherence(period = '30d', userId = null) {
    const { startDate, endDate, days } = _getDateRangeForPeriod(period)

    // Usa userId fornecido ou busca do Supabase
    const resolvedUserId = userId || (await getUserId())

    // Buscar protocolos ativos no período
    const { data: protocols, error: protocolError } = await supabase
      .from('protocols')
      .select('*')
      .eq('user_id', resolvedUserId)
      .eq('active', true)

    if (protocolError) throw protocolError

    // M7.2: HEAD request — apenas count, sem dados (zero bytes transferidos)
    const { count, error: logError } = await supabase
      .from('medicine_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', resolvedUserId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())

    if (logError) throw logError

    // Calcular doses esperadas (passar endDate para consistência)
    const expectedDoses = calculateExpectedDoses(protocols, days, endDate)

    // Contar doses registradas
    const takenDoses = count || 0

    // Calcular score (0-100)
    const score = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0

    return {
      score: Math.min(score, 100), // Cap at 100%
      taken: takenDoses,
      expected: expectedDoses,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  },

  /**
   * Calcula adesão por protocolo específico
   * @param {string} protocolId - ID do protocolo
   * @param {string} period - Período: '7d', '30d', '90d'
   * @param {string} [userId] - ID do usuário (opcional, evita chamadas redundantes ao getUser)
   * @returns {Promise<{protocolId: string, name: string, score: number, taken: number, expected: number}>}
   */
  async calculateProtocolAdherence(protocolId, period = '30d', userId = null) {
    const days = parseInt(period)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Usa userId fornecido ou busca do Supabase
    const resolvedUserId = userId || (await getUserId())

    // Buscar protocolo específico
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
      .eq('id', protocolId)
      .eq('user_id', resolvedUserId)
      .single()

    if (protocolError) throw protocolError

    // Buscar logs do protocolo no período
    const { data: logs, error: logError } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('protocol_id', protocolId)
      .eq('user_id', resolvedUserId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())

    if (logError) throw logError

    // Calcular doses esperadas para este protocolo
    const expectedDoses = calculateExpectedDoses([protocol], days)
    const takenDoses = logs?.length || 0

    const score = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0

    return {
      protocolId,
      name: protocol.name,
      medicineName: protocol.medicine?.name,
      score: Math.min(score, 100),
      taken: takenDoses,
      expected: expectedDoses,
    }
  },

  /**
   * Calcula adesão para todos os protocolos ativos
   * @param {string} period - Período: '7d', '30d', '90d'
   * @param {string} [userId] - ID do usuário (opcional, evita chamadas redundantes ao getUser)
   * @returns {Promise<Array<{protocolId: string, name: string, score: number}>>}
   */
  async calculateAllProtocolsAdherence(period = '30d', userId = null) {
    const { startDate, endDate, days } = _getDateRangeForPeriod(period)

    // Usa userId fornecido ou busca do Supabase
    const resolvedUserId = userId || (await getUserId())

    // Query 1: Buscar todos os protocolos ativos
    const { data: protocols, error } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
      .eq('user_id', resolvedUserId)
      .eq('active', true)

    if (error) throw error

    if (!protocols || protocols.length === 0) return []

    // M7.1: Query 2 (batch): Buscar APENAS protocol_id — não select('*')
    // Transfere ~50 bytes por log ao invés de ~500 bytes (select '*')
    const { data: allLogs, error: logError } = await supabase
      .from('medicine_logs')
      .select('protocol_id')
      .eq('user_id', resolvedUserId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())

    if (logError) throw logError

    // M7.1: Agrupar por protocol_id client-side — O(M) uma vez
    // Em vez de O(M) × N separado (N = número de protocolos)
    const takenByProtocol = new Map()
    ;(allLogs || []).forEach((log) => {
      if (log.protocol_id) {
        takenByProtocol.set(log.protocol_id, (takenByProtocol.get(log.protocol_id) || 0) + 1)
      }
    })

    // Calcular scores sem mais queries
    return protocols.map((protocol) => {
      const expected = calculateExpectedDoses([protocol], days, endDate)
      const taken = takenByProtocol.get(protocol.id) || 0
      const score = expected > 0 ? Math.min(Math.round((taken / expected) * 100), 100) : 0
      return {
        protocolId: protocol.id,
        name: protocol.name,
        medicineName: protocol.medicine?.name,
        score,
        taken,
        expected,
        error: false,
      }
    })
  },

  /**
   * Calcula o streak atual (dias seguidos com adesão >= 80%)
   * @param {string} [userId] - ID do usuário (opcional, evita chamadas redundantes ao getUser)
   * @returns {Promise<{currentStreak: number, longestStreak: number}>}
   */
  async getCurrentStreak(userId = null) {
    // Usa userId fornecido ou busca do Supabase
    const resolvedUserId = userId || (await getUserId())

    // Buscar logs dos últimos 90 dias
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const { data: logs, error } = await supabase
      .from('medicine_logs')
      .select('taken_at')
      .eq('user_id', resolvedUserId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())
      .order('taken_at', { ascending: false })

    if (error) throw error

    // Buscar protocolos ativos para calcular doses esperadas por dia
    const { data: protocols, error: protocolError } = await supabase
      .from('protocols')
      .select('*')
      .eq('user_id', resolvedUserId)
      .eq('active', true)

    if (protocolError) throw protocolError

    // Verificar se há protocolos ativos
    if (!protocols || protocols.length === 0 || !logs || logs.length === 0) {
      return { currentStreak: 0, longestStreak: 0 }
    }

    // Agrupar logs por dia
    const logsByDay = groupLogsByDay(logs)

    // Calcular streaks (passa protocols para calcular expected por dia)
    const { currentStreak, longestStreak } = calculateStreaks(logsByDay, protocols)

    return { currentStreak, longestStreak }
  },

  /**
   * Calcula o maior streak histórico
   * @returns {Promise<number>}
   */
  async getLongestStreak() {
    const { longestStreak } = await this.getCurrentStreak()
    return longestStreak
  },

  /**
   * Retorna resumo completo de adesão para o Dashboard
   * @param {string} period - Período: '7d', '30d', '90d'
   * @returns {Promise<Object>}
   */
  async getAdherenceSummary(period = '30d') {
    const userId = await getUserId()

    // Buscar protocols UMA VEZ — evita 3 queries idênticas nas sub-funções
    const { data: protocols, error: protocolError } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
      .eq('user_id', userId)
      .eq('active', true)

    if (protocolError) throw protocolError

    // Passa protocols pré-carregados para todas as sub-funções
    const results = await Promise.allSettled([
      this._calculateAdherenceWithProtocols(period, userId, protocols),
      this._calculateAllProtocolsAdherenceWithProtocols(period, userId, protocols),
      this._getCurrentStreakWithProtocols(userId, protocols),
    ])

    const overall =
      results[0].status === 'fulfilled' ? results[0].value : { score: 0, taken: 0, expected: 0 }
    const protocolScores = results[1].status === 'fulfilled' ? results[1].value : []
    const streaks =
      results[2].status === 'fulfilled'
        ? results[2].value
        : { currentStreak: 0, longestStreak: 0 }

    return {
      overallScore: overall.score,
      overallTaken: overall.taken,
      overallExpected: overall.expected,
      period,
      protocolScores,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
    }
  },

  /**
   * Retorna dados de adesão por dia para sparkline
   * @param {number} days - Número de dias (padrão: 7)
   * @returns {Promise<Array<{date: string, adherence: number, taken: number, expected: number}>>}
   */
  async getDailyAdherence(days = 7) {
    const userId = await getUserId()

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Buscar protocolos ativos
    const { data: protocols, error: protocolError } = await supabase
      .from('protocols')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)

    if (protocolError) throw protocolError

    // Expandir range de busca para compensar fuso horário
    // Doses tomadas em GMT-3 podem aparecer no dia seguinte em UTC
    const adjustedStartDate = new Date(startDate)
    adjustedStartDate.setHours(adjustedStartDate.getHours() - 24)

    const adjustedEndDate = new Date(endDate)
    adjustedEndDate.setHours(adjustedEndDate.getHours() + 24)

    // Buscar logs no período (com range expandido para timezone)
    const { data: logs, error: logError } = await supabase
      .from('medicine_logs')
      .select('taken_at')
      .eq('user_id', userId)
      .gte('taken_at', adjustedStartDate.toISOString())
      .lte('taken_at', adjustedEndDate.toISOString())

    if (logError) throw logError

    // Agrupar logs por dia
    const logsByDay = groupLogsByDay(logs)

    // Gerar array com dados para cada dia (usando data local)
    const dailyData = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(endDate)
      date.setDate(date.getDate() - i)
      const dateKey = formatLocalDate(date)

      // Calcular doses esperadas para este dia específico (filtra por start_date/end_date)
      const dayExpected = calculateDailyExpectedDoses(protocols, dateKey)

      const taken = logsByDay.get(dateKey) || 0
      const adherence = dayExpected > 0 ? Math.round((taken / dayExpected) * 100) : 0

      dailyData.push({
        date: dateKey,
        taken,
        expected: Math.round(dayExpected),
        adherence: Math.min(adherence, 100),
      })
    }

    return dailyData
  },

  /**
   * Retorna dados de adesão diária DIRETAMENTE DA VIEW (M3 — sem processamento client)
   * @param {number} days - Número de dias (padrão: 30)
   * @returns {Promise<Array<{date: string, adherence: number, taken: number, expected: number}>>}
   */
  async getDailyAdherenceFromView(days = 30) {
    // Validar input com Zod
    const validation = GetDailyAdherenceFromViewSchema.safeParse({ days })
    if (!validation.success) {
      console.error(
        '[adherenceService] Erro validação getDailyAdherenceFromView:',
        validation.error.format()
      )
      return []
    }

    const { days: validDays } = validation.data
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - validDays)

    const startDateStr = formatLocalDate(startDate)
    const endDateStr = formatLocalDate(endDate)

    const { data, error } = await supabase
      .from('v_daily_adherence')
      .select('log_date, expected_doses, taken_doses, adherence_percentage')
      .gte('log_date', startDateStr)
      .lte('log_date', endDateStr)
      .order('log_date', { ascending: true })

    if (error) {
      console.error('[adherenceService] getDailyAdherenceFromView erro:', error)
      throw error
    }

    // Adaptar nomes das colunas para match com SparklineAdesao
    return (data || []).map((row) => ({
      date: row.log_date,
      taken: row.taken_doses,
      expected: row.expected_doses,
      adherence: row.adherence_percentage ?? 0, // NULL → 0% se sem protocolo
    }))
  },

  /**
   * Retorna padrões de adesão HEATMAP DIRETAMENTE DA VIEW (M3 — sem processamento client)
   * Transforma array de linhas (28 = 7×4) em grid 7×4
   * @returns {Promise<{grid: Array, worstCell: Object|null, narrative: string, hasEnoughData: boolean, dayOccurrences: Array}>}
   */
  async getAdherencePatternFromView() {
    const { data, error } = await supabase
      .from('v_adherence_heatmap')
      .select('day_of_week, period_index, expected_doses, taken_doses, adherence_percentage')
      .order('day_of_week')
      .order('period_index')

    if (error) {
      console.error('[adherenceService] getAdherencePatternFromView erro:', error)
      throw error
    }

    // Inicializar e preencher grid de adesão 7×4
    const grid = buildAdherenceGrid(data)

    // Calcular hasEnoughData: pelo menos 7 células com expected_doses > 0
    // (1 período por dia × 7 dias da semana — usuários com só manhã+noite têm 14 células max)
    const filledCells = (data || []).filter((row) => row.expected_doses > 0).length
    const hasEnoughData = filledCells >= 7

    // Encontrar pior célula e gerar narrativa
    const { worstCell, narrative } = buildHeatmapNarrative(data, hasEnoughData)

    return {
      grid,
      worstCell: hasEnoughData ? worstCell : null,
      narrative,
      hasEnoughData,
      dayOccurrences: [0, 0, 0, 0, 0, 0, 0], // Compatibilidade com analyzeAdherencePatterns
    }
  },

  /**
   * @private Variante de calculateAdherence que recebe protocols pré-carregados
   */
  async _calculateAdherenceWithProtocols(period, userId, protocols) {
    const { startDate, endDate, days } = _getDateRangeForPeriod(period)

    // HEAD request — apenas count, zero dados transferidos
    const { count, error: logError } = await supabase
      .from('medicine_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())

    if (logError) throw logError

    const expectedDoses = calculateExpectedDoses(protocols, days, endDate)
    const takenDoses = count || 0
    const score = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0

    return {
      score: Math.min(score, 100),
      taken: takenDoses,
      expected: expectedDoses,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  },

  /**
   * @private Variante de calculateAllProtocolsAdherence que recebe protocols pré-carregados
   */
  async _calculateAllProtocolsAdherenceWithProtocols(period, userId, protocols) {
    const { startDate, endDate, days } = _getDateRangeForPeriod(period)

    if (!protocols || protocols.length === 0) return []

    // Batch: APENAS protocol_id — ~50 bytes por log ao invés de ~500
    const { data: allLogs, error: logError } = await supabase
      .from('medicine_logs')
      .select('protocol_id')
      .eq('user_id', userId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())

    if (logError) throw logError

    // Agrupar por protocol_id client-side: O(M) uma vez
    const takenByProtocol = new Map()
    ;(allLogs || []).forEach((log) => {
      if (log.protocol_id) {
        takenByProtocol.set(log.protocol_id, (takenByProtocol.get(log.protocol_id) || 0) + 1)
      }
    })

    return protocols.map((protocol) => {
      const expected = calculateExpectedDoses([protocol], days, endDate)
      const taken = takenByProtocol.get(protocol.id) || 0
      const score = expected > 0 ? Math.min(Math.round((taken / expected) * 100), 100) : 0
      return {
        protocolId: protocol.id,
        name: protocol.name,
        medicineName: protocol.medicine?.name,
        score,
        taken,
        expected,
        error: false,
      }
    })
  },

  /**
   * @private Variante de getCurrentStreak que recebe protocols pré-carregados
   */
  async _getCurrentStreakWithProtocols(userId, protocols) {
    if (!protocols || protocols.length === 0) {
      return { currentStreak: 0, longestStreak: 0 }
    }

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const { data: logs, error } = await supabase
      .from('medicine_logs')
      .select('taken_at')
      .eq('user_id', userId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())
      .order('taken_at', { ascending: false })

    if (error) throw error

    if (!logs || logs.length === 0) {
      return { currentStreak: 0, longestStreak: 0 }
    }

    const logsByDay = groupLogsByDay(logs)
    const { currentStreak, longestStreak } = calculateStreaks(logsByDay, protocols)

    return { currentStreak, longestStreak }
  },
}

/**
 * Calcula doses esperadas para um conjunto de protocolos.
 * Considera start_date e end_date para calcular dias efetivos de cada protocolo.
 *
 * @param {Array} protocols - Array de protocolos
 * @param {number} days - Número de dias do período de análise
 * @param {Date} endDate - Data final do período (padrão: hoje)
 * @returns {number}
 */
function calculateExpectedDoses(protocols, days, endDate = new Date()) {
  if (!protocols || protocols.length === 0) return 0

  // Calcular data de início do período de análise
  const periodStart = new Date(endDate)
  periodStart.setHours(0, 0, 0, 0)
  periodStart.setDate(periodStart.getDate() - days + 1)

  const periodEnd = new Date(endDate)
  periodEnd.setHours(23, 59, 59, 999)

  return protocols.reduce((total, protocol) => {
    const timesPerDay = protocol.time_schedule?.length || 1
    const frequency = protocol.frequency || 'daily'

    // Calcular frequência real baseada na configuração
    let dailyDoses = timesPerDay

    // Ajustar baseado na frequência
    switch (frequency.toLowerCase()) {
      case 'daily':
      case 'diariamente':
      case 'diário':
        dailyDoses = timesPerDay
        break
      case 'weekly':
      case 'semanal':
      case 'semanalmente':
        dailyDoses = timesPerDay / 7
        break
      case 'every_other_day':
      case 'dia_sim_dia_nao':
      case 'dia sim, dia não':
        dailyDoses = timesPerDay / 2
        break
      default:
        dailyDoses = timesPerDay
    }

    // Calcular dias efetivos do protocolo dentro do período de análise
    let effectiveDays = 0

    // Se não tiver start_date, assume que o protocolo estava ativo desde o início do período
    const protocolStartDate = protocol.start_date
      ? parseLocalDate(protocol.start_date)
      : periodStart

    // Se não tiver end_date, assume que o protocolo continua ativo
    const protocolEndDate = protocol.end_date
      ? new Date(protocol.end_date + 'T23:59:59')
      : periodEnd

    // Calcular interseção entre período do protocolo e período de análise
    const effectiveStart = new Date(Math.max(protocolStartDate, periodStart))
    const effectiveEnd = new Date(Math.min(protocolEndDate, periodEnd))

    // Calcular número de dias efetivos (inclusive)
    if (effectiveEnd >= effectiveStart) {
      const diffTime = effectiveEnd.getTime() - effectiveStart.getTime()
      effectiveDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    return total + dailyDoses * Math.max(effectiveDays, 0)
  }, 0)
}

/**
 * Calcula doses esperadas por dia para uma data específica.
 * Filtra protocolos que estavam ativos na data.
 *
 * @param {Array} protocols - Array de protocolos
 * @param {string} dateStr - Data no formato YYYY-MM-DD (opcional, padrão: hoje)
 * @returns {number}
 */
function calculateDailyExpectedDoses(protocols, dateStr = null) {
  if (!protocols || protocols.length === 0) return 0

  // Se não houver data, usar hoje
  const targetDate = dateStr || formatLocalDate(new Date())

  return protocols.reduce((total, protocol) => {
    // Verificar se o protocolo estava ativo nesta data
    if (!isProtocolActiveOnDate(protocol, targetDate)) return total

    const timesPerDay = protocol.time_schedule?.length || 1
    return total + timesPerDay
  }, 0)
}

/**
 * Agrupa logs por dia usando fuso horário local do usuário
 * @param {Array} logs - Array de logs
 * @returns {Map<string, number>}
 */
function groupLogsByDay(logs) {
  const days = new Map()

  logs.forEach((log) => {
    const dayKey = formatLocalDate(new Date(log.taken_at))
    days.set(dayKey, (days.get(dayKey) || 0) + 1)
  })

  return days
}

/**
 * Calcula streaks (atual e maior)
 * Considera start_date e end_date dos protocolos para calcular expected por dia.
 *
 * @param {Map} logsByDay - Logs agrupados por dia
 * @param {Array} protocols - Array de protocolos ativos
 * @returns {{currentStreak: number, longestStreak: number}}
 */
function calculateStreaks(logsByDay, protocols) {
  // Criar array de datas ordenadas (mais recente primeiro)
  const dates = Array.from(logsByDay.keys()).sort().reverse()

  if (dates.length === 0 || !protocols || protocols.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  let isCurrent = true
  const minAdherenceRate = 0.8 // 80% de adesão para contar o dia

  // Usar funções utilitárias para today/yesterday (timezone local)
  const today = formatLocalDate(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayKey = formatLocalDate(yesterdayDate)

  // Calcular expected para hoje e ontem
  const todayExpected = calculateDailyExpectedDoses(protocols, today)
  const yesterdayExpected = calculateDailyExpectedDoses(protocols, yesterdayKey)

  // Verificar se o streak ainda está ativo
  const lastLogDate = dates[0]
  const hasTakenToday =
    lastLogDate === today &&
    todayExpected > 0 &&
    (logsByDay.get(today) || 0) >= todayExpected * minAdherenceRate
  const hasTakenYesterday =
    lastLogDate === yesterdayKey ||
    (dates.includes(yesterdayKey) &&
      yesterdayExpected > 0 &&
      (logsByDay.get(yesterdayKey) || 0) >= yesterdayExpected * minAdherenceRate)

  if (!hasTakenToday && !hasTakenYesterday) {
    isCurrent = false
  }

  // Calcular streak atual
  let checkDate = new Date()
  while (true) {
    const dateKey = formatLocalDate(checkDate)

    // Calcular expected para este dia específico (filtra por start_date/end_date)
    const dayExpected = calculateDailyExpectedDoses(protocols, dateKey)

    const taken = logsByDay.get(dateKey) || 0
    const adherenceRate = dayExpected > 0 ? taken / dayExpected : 0

    // Se não há doses esperadas neste dia (protocolo ainda não tinha começado ou já terminou),
    // não conta nem quebra o streak
    if (dayExpected === 0) {
      // Continua para o próximo dia sem afetar o streak
    } else if (adherenceRate >= minAdherenceRate) {
      if (isCurrent) currentStreak++
      tempStreak++
    } else {
      if (isCurrent) {
        // Verificar se é hoje (ainda pode tomar)
        if (dateKey === today) {
          // Não quebra o streak ainda
        } else {
          isCurrent = false
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak)
      tempStreak = 0
    }

    // Ir para o dia anterior
    checkDate.setDate(checkDate.getDate() - 1)

    // Parar se passou de 90 dias
    if (tempStreak === 0 && !isCurrent && checkDate < new Date(Date.now() - 90 * 86400000)) {
      break
    }
    if (tempStreak > 90) break // Safety limit
  }

  longestStreak = Math.max(longestStreak, tempStreak)

  return { currentStreak, longestStreak }
}

export default adherenceService
