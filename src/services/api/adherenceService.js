import { supabase, getUserId } from '../../lib/supabase'

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
   * @returns {Promise<{score: number, taken: number, expected: number, period: string}>}
   */
  async calculateAdherence(period = '30d') {
    const days = parseInt(period)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const userId = await getUserId()

    // Buscar protocolos ativos no período
    const { data: protocols, error: protocolError } = await supabase
      .from('protocols')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)

    if (protocolError) throw protocolError

    // Buscar logs no período
    const { data: logs, error: logError } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())

    if (logError) throw logError

    // Calcular doses esperadas
    const expectedDoses = calculateExpectedDoses(protocols, days)

    // Contar doses registradas
    const takenDoses = logs?.length || 0

    // Calcular score (0-100)
    const score = expectedDoses > 0 
      ? Math.round((takenDoses / expectedDoses) * 100)
      : 0

    return {
      score: Math.min(score, 100), // Cap at 100%
      taken: takenDoses,
      expected: expectedDoses,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  },

  /**
   * Calcula adesão por protocolo específico
   * @param {string} protocolId - ID do protocolo
   * @param {string} period - Período: '7d', '30d', '90d'
   * @returns {Promise<{protocolId: string, name: string, score: number, taken: number, expected: number}>}
   */
  async calculateProtocolAdherence(protocolId, period = '30d') {
    const days = parseInt(period)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const userId = await getUserId()

    // Buscar protocolo específico
    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
      .eq('id', protocolId)
      .eq('user_id', userId)
      .single()

    if (protocolError) throw protocolError

    // Buscar logs do protocolo no período
    const { data: logs, error: logError } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('protocol_id', protocolId)
      .eq('user_id', userId)
      .gte('taken_at', startDate.toISOString())
      .lte('taken_at', endDate.toISOString())

    if (logError) throw logError

    // Calcular doses esperadas para este protocolo
    const expectedDoses = calculateExpectedDoses([protocol], days)
    const takenDoses = logs?.length || 0

    const score = expectedDoses > 0
      ? Math.round((takenDoses / expectedDoses) * 100)
      : 0

    return {
      protocolId,
      name: protocol.name,
      medicineName: protocol.medicine?.name,
      score: Math.min(score, 100),
      taken: takenDoses,
      expected: expectedDoses
    }
  },

  /**
   * Calcula adesão para todos os protocolos ativos
   * @param {string} period - Período: '7d', '30d', '90d'
   * @returns {Promise<Array<{protocolId: string, name: string, score: number}>>}
   */
  async calculateAllProtocolsAdherence(period = '30d') {
    const userId = await getUserId()

    // Buscar todos os protocolos ativos
    const { data: protocols, error } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
      .eq('user_id', userId)
      .eq('active', true)

    if (error) throw error

    // Calcular adesão para cada protocolo
    const adherencePromises = protocols.map(async (protocol) => {
      try {
        return await this.calculateProtocolAdherence(protocol.id, period)
      } catch (err) {
        console.error(`Erro ao calcular adesão para protocolo ${protocol.id}:`, err)
        return {
          protocolId: protocol.id,
          name: protocol.name,
          medicineName: protocol.medicine?.name,
          score: 0,
          taken: 0,
          expected: 0,
          error: true
        }
      }
    })

    return Promise.all(adherencePromises)
  },

  /**
   * Calcula o streak atual (dias seguidos com adesão >= 80%)
   * @returns {Promise<{currentStreak: number, longestStreak: number}>}
   */
  async getCurrentStreak() {
    const userId = await getUserId()

    // Buscar logs dos últimos 90 dias
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

    // Buscar protocolos ativos para calcular doses esperadas por dia
    const { data: protocols, error: protocolError } = await supabase
      .from('protocols')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)

    if (protocolError) throw protocolError

    const dailyExpected = calculateDailyExpectedDoses(protocols)

    if (dailyExpected === 0 || !logs || logs.length === 0) {
      return { currentStreak: 0, longestStreak: 0 }
    }

    // Agrupar logs por dia
    const logsByDay = groupLogsByDay(logs)

    // Calcular streaks
    const { currentStreak, longestStreak } = calculateStreaks(logsByDay, dailyExpected)

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
    const [overall, protocols, streaks] = await Promise.all([
      this.calculateAdherence(period),
      this.calculateAllProtocolsAdherence(period),
      this.getCurrentStreak()
    ])

    return {
      overallScore: overall.score,
      overallTaken: overall.taken,
      overallExpected: overall.expected,
      period,
      protocolScores: protocols,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak
    }
  }
}

/**
 * Calcula doses esperadas para um conjunto de protocolos
 * @param {Array} protocols - Array de protocolos
 * @param {number} days - Número de dias
 * @returns {number}
 */
function calculateExpectedDoses(protocols, days) {
  if (!protocols || protocols.length === 0) return 0

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

    return total + (dailyDoses * days)
  }, 0)
}

/**
 * Calcula doses esperadas por dia
 * @param {Array} protocols - Array de protocolos
 * @returns {number}
 */
function calculateDailyExpectedDoses(protocols) {
  if (!protocols || protocols.length === 0) return 0

  return protocols.reduce((total, protocol) => {
    const timesPerDay = protocol.time_schedule?.length || 1
    return total + timesPerDay
  }, 0)
}

/**
 * Agrupa logs por dia (YYYY-MM-DD)
 * @param {Array} logs - Array de logs
 * @returns {Map<string, number>}
 */
function groupLogsByDay(logs) {
  const days = new Map()

  logs.forEach(log => {
    const date = new Date(log.taken_at)
    const dayKey = date.toISOString().split('T')[0]
    days.set(dayKey, (days.get(dayKey) || 0) + 1)
  })

  return days
}

/**
 * Calcula streaks (atual e maior)
 * @param {Map} logsByDay - Logs agrupados por dia
 * @param {number} dailyExpected - Doses esperadas por dia
 * @returns {{currentStreak: number, longestStreak: number}}
 */
function calculateStreaks(logsByDay, dailyExpected) {
  // Criar array de datas ordenadas (mais recente primeiro)
  const dates = Array.from(logsByDay.keys()).sort().reverse()

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  let isCurrent = true
  const minAdherenceRate = 0.8 // 80% de adesão para contar o dia

  // Verificar cada dia
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Verificar se o streak ainda está ativo
  const lastLogDate = dates[0]
  const hasTakenToday = lastLogDate === today && (logsByDay.get(today) || 0) >= dailyExpected * minAdherenceRate
  const hasTakenYesterday = lastLogDate === yesterday || (dates.includes(yesterday) && (logsByDay.get(yesterday) || 0) >= dailyExpected * minAdherenceRate)

  if (!hasTakenToday && !hasTakenYesterday) {
    isCurrent = false
  }

  // Calcular streak atual
  let checkDate = new Date()
  while (true) {
    const dateKey = checkDate.toISOString().split('T')[0]
    const taken = logsByDay.get(dateKey) || 0
    const adherenceRate = dailyExpected > 0 ? taken / dailyExpected : 0

    if (adherenceRate >= minAdherenceRate) {
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
