import { z } from 'zod'
import { supabase, getUserId } from '@shared/utils/supabase'
import { addDays, getRawNow, parseISO, formatLocalDate, getUserTime } from '@utils/dateUtils'
import {
  createDoseInstanceRepository,
  computeAdherenceFromInstances,
  computeStreakFromInstances,
  computeLongestStreakFromInstances,
} from '@dosiq/core'

// Repository de dose_instances (Fase 3 — leitura de adesão consulta ocorrências
// materializadas por status em vez de inferir sobre logs ±2h, R-248).
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase })

// Schema para validação de parâmetros
const GetDailyAdherenceFromViewSchema = z.object({
  days: z.number().int().positive().max(365, 'Máximo 365 dias').default(30),
})

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const PERIOD_NAMES = ['Madrugada', 'Manhã', 'Tarde', 'Noite']

/** tz default (G1 — injeção real do tz do usuário fica para a Fase 4; default SP). */
const DEFAULT_TZ = 'America/Sao_Paulo'

/**
 * Extrai intervalo de datas baseado em um período string.
 * Usa instantes absolutos reais (getRawNow) — `scheduled_for` é timestamptz.
 * @param {string} period - Período: '7d', '30d', '90d'
 * @returns {{days: number, endDate: Date, startDate: Date}}
 */
function _getDateRangeForPeriod(period) {
  const days = parseInt(period)
  const endDate = getRawNow()
  const startDate = addDays(endDate, -days)
  return { startDate, endDate, days }
}

/**
 * Score binário a partir de contagens por status: taken / (taken + missed).
 * pending/skipped_* ficam fora do denominador (R-248). Sem dados → score 0
 * (UI espera número, não null) e expected 0.
 * @param {number} taken
 * @param {number} missed
 * @returns {{score: number, expected: number}}
 */
function _score(taken, missed) {
  const expected = taken + missed
  const score = expected > 0 ? Math.min(Math.round((taken / expected) * 100), 100) : 0
  return { score, expected }
}

/**
 * Agrupa instâncias por `protocol_id`.
 * @param {Array<Object>} instances
 * @returns {Map<string, Array<Object>>}
 */
function _groupByProtocol(instances) {
  const byProtocol = new Map()
  for (const inst of instances || []) {
    const key = inst?.protocol_id
    if (!key) continue
    let arr = byProtocol.get(key)
    if (!arr) {
      arr = []
      byProtocol.set(key, arr)
    }
    arr.push(inst)
  }
  return byProtocol
}

/**
 * Dia local (tz) de um instante (`scheduled_for` ISO ou Date).
 * @param {string|Date} value
 * @param {string} [tz]
 * @returns {string} YYYY-MM-DD
 */
function _dayKey(value, tz = DEFAULT_TZ) {
  const date = typeof value === 'string' ? parseISO(value) : value
  return formatLocalDate(getUserTime(date, tz))
}

/**
 * Monta o score de um protocolo a partir de suas instâncias na janela.
 * @param {Object} protocol - { id, name, medicine }
 * @param {Array<Object>} instances - instâncias do protocolo
 * @returns {Object}
 */
function _protocolScore(protocol, instances) {
  const agg = computeAdherenceFromInstances(instances)
  const { score, expected } = _score(agg.taken, agg.missed)
  return {
    protocolId: protocol.id,
    name: protocol.name,
    medicineName: protocol.medicine?.name,
    score,
    taken: agg.taken,
    expected,
    error: false,
  }
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
 * Fase 3 (R-248): adesão é CONSULTADA das `dose_instances` por status
 * (`taken`/`missed`/`pending`/`skipped_*`), não mais inferida por casamento ±2h
 * sobre `medicine_logs`. Escalares usam `countByStatus` (head-count server-agg,
 * R-249); summary/streak/daily usam `getWindow` em janelas curtas (volume bounded).
 *
 * Adesão = taken / (taken + missed) × 100. pending e skipped_* ficam fora do
 * denominador (pausa/skip consciente não penaliza).
 *
 * @module adherenceService
 */
export const adherenceService = {
  /**
   * Calcula o score de adesão geral do usuário (todas as ocorrências na janela).
   * @param {string} period - Período: '7d', '30d', '90d'
   * @param {string} [userId] - ID do usuário (evita getUser redundante)
   * @returns {Promise<{score: number, taken: number, expected: number, period: string}>}
   */
  async calculateAdherence(period = '30d', userId = null) {
    const { startDate, endDate } = _getDateRangeForPeriod(period)
    const resolvedUserId = userId || (await getUserId())

    const counts = await doseInstanceRepo.countByStatus({
      userId: resolvedUserId,
      fromTs: startDate,
      toTs: endDate,
    })
    const { score, expected } = _score(counts.taken, counts.missed)

    return {
      score,
      taken: counts.taken,
      expected,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  },

  /**
   * Calcula adesão por protocolo específico.
   * @param {string} protocolId
   * @param {string} period - '7d', '30d', '90d'
   * @param {string} [userId]
   * @returns {Promise<{protocolId, name, medicineName, score, taken, expected}>}
   */
  async calculateProtocolAdherence(protocolId, period = '30d', userId = null) {
    const { startDate, endDate } = _getDateRangeForPeriod(period)
    const resolvedUserId = userId || (await getUserId())

    const { data: protocol, error: protocolError } = await supabase
      .from('protocols')
      .select('name, medicine:medicines(name)')
      .eq('id', protocolId)
      .eq('user_id', resolvedUserId)
      .single()

    if (protocolError) throw protocolError

    const counts = await doseInstanceRepo.countByStatus({
      userId: resolvedUserId,
      protocolId,
      fromTs: startDate,
      toTs: endDate,
    })
    const { score, expected } = _score(counts.taken, counts.missed)

    return {
      protocolId,
      name: protocol?.name,
      medicineName: (protocol?.medicine as any)?.name,
      score,
      taken: counts.taken,
      expected,
    }
  },

  /**
   * Calcula adesão para todos os protocolos ativos.
   * Uma janela de instâncias + agrupamento client-side (volume bounded, R-249).
   * @param {string} period - '7d', '30d', '90d'
   * @param {string} [userId]
   * @returns {Promise<Array<{protocolId, name, score, taken, expected}>>}
   */
  async calculateAllProtocolsAdherence(period = '30d', userId = null) {
    const { startDate, endDate } = _getDateRangeForPeriod(period)
    const resolvedUserId = userId || (await getUserId())

    const { data: protocols, error } = await supabase
      .from('protocols')
      .select('id, name, medicine:medicines(name)')
      .eq('user_id', resolvedUserId)
      .eq('active', true)

    if (error) throw error
    if (!protocols || protocols.length === 0) return []

    const instances = await doseInstanceRepo.getWindow(resolvedUserId, startDate, endDate)
    const byProtocol = _groupByProtocol(instances)

    return protocols.map((p) => _protocolScore(p, byProtocol.get(p.id) || []))
  },

  /**
   * Streak atual + maior streak, das ocorrências dos últimos 90 dias.
   * @param {string} [userId]
   * @returns {Promise<{currentStreak: number, longestStreak: number}>}
   */
  async getCurrentStreak(userId = null) {
    const resolvedUserId = userId || (await getUserId())
    const endDate = getRawNow()
    const startDate = addDays(endDate, -90)

    const instances = await doseInstanceRepo.getWindow(resolvedUserId, startDate, endDate)

    return {
      currentStreak: computeStreakFromInstances(instances, { tz: DEFAULT_TZ }),
      longestStreak: computeLongestStreakFromInstances(instances, { tz: DEFAULT_TZ }),
    }
  },

  /**
   * Maior streak histórico (janela de 90 dias).
   * @returns {Promise<number>}
   */
  async getLongestStreak() {
    const { longestStreak } = await this.getCurrentStreak()
    return longestStreak
  },

  /**
   * Resumo completo de adesão para o Dashboard. Uma janela de 90d cobre tanto o
   * período pedido (filtrado) quanto o streak — 1 fetch de instâncias + 1 de protocolos.
   * @param {string} period - '7d', '30d', '90d'
   * @returns {Promise<Object>}
   */
  async getAdherenceSummary(period = '30d') {
    const userId = await getUserId()
    const endDate = getRawNow()
    const start90 = addDays(endDate, -90)

    const { data: protocols, error: protocolError } = await supabase
      .from('protocols')
      .select('id, name, medicine:medicines(name)')
      .eq('user_id', userId)
      .eq('active', true)

    if (protocolError) throw protocolError

    const instances = await doseInstanceRepo.getWindow(userId, start90, endDate)

    // Subconjunto do período pedido (período máximo é 90d, coberto pela janela).
    const days = parseInt(period)
    const periodMs = addDays(endDate, -days).getTime()
    const periodInstances = (instances || []).filter((i) => i?.scheduled_for && parseISO(i.scheduled_for).getTime() >= periodMs)

    const overallAgg = computeAdherenceFromInstances(periodInstances)
    const { score: overallScore, expected: overallExpected } = _score(
      overallAgg.taken,
      overallAgg.missed
    )

    const byProtocol = _groupByProtocol(periodInstances)
    const protocolScores = (protocols || []).map((p) =>
      _protocolScore(p, byProtocol.get(p.id) || [])
    )

    return {
      overallScore,
      overallTaken: overallAgg.taken,
      overallExpected,
      period,
      protocolScores,
      currentStreak: computeStreakFromInstances(instances, { tz: DEFAULT_TZ }),
      longestStreak: computeLongestStreakFromInstances(instances, { tz: DEFAULT_TZ }),
    }
  },

  /**
   * Adesão por dia (sparkline). Deriva de `dose_instances` agrupadas por dia local.
   * @param {number} days - Número de dias (padrão: 7)
   * @returns {Promise<Array<{date, taken, expected, adherence}>>}
   */
  async getDailyAdherence(days = 7) {
    const userId = await getUserId()
    const endDate = getRawNow()
    const startDate = addDays(endDate, -days)

    // Pad ±1 dia para capturar instâncias na fronteira de fuso.
    const instances = await doseInstanceRepo.getWindow(
      userId,
      addDays(startDate, -1),
      addDays(endDate, 1)
    )

    // Agrupar instâncias por dia local.
    const byDay = new Map()
    for (const inst of instances || []) {
      if (!inst?.scheduled_for) continue
      const key = _dayKey(inst.scheduled_for)
      let arr = byDay.get(key)
      if (!arr) {
        arr = []
        byDay.set(key, arr)
      }
      arr.push(inst)
    }

    const dailyData = []
    for (let i = days - 1; i >= 0; i--) {
      const dateKey = _dayKey(addDays(endDate, -i))
      const agg = computeAdherenceFromInstances(byDay.get(dateKey) || [])
      const { score, expected } = _score(agg.taken, agg.missed)
      dailyData.push({
        date: dateKey,
        taken: agg.taken,
        expected,
        adherence: score,
      })
    }

    return dailyData
  },

  /**
   * Retorna dados de adesão diária DIRETAMENTE DA VIEW (M3 — sem processamento client).
   * ⚠️ View server-agg (R-249, mitigação OOM low-mid). Migração da fonte para
   * `dose_instances` é escopo da Fase 4 (G6/S4.2b) — NÃO tocar aqui.
   * @param {number} days - Número de dias (padrão: 30)
   * @returns {Promise<Array<{date, adherence, taken, expected}>>}
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
    const endDate = getRawNow()
    const startDate = addDays(endDate, -validDays)

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
   * Retorna padrões de adesão HEATMAP DIRETAMENTE DA VIEW (M3 — sem processamento client).
   * ⚠️ View server-agg (R-249). Migração da fonte para `dose_instances` é escopo
   * da Fase 4 (G6/S4.2b) — NÃO tocar aqui.
   * @returns {Promise<{grid, worstCell, narrative, hasEnoughData, dayOccurrences}>}
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
   * @private Variante de calculateAdherence que recebe protocols pré-carregados.
   * (protocols não é mais necessário — adesão vem das instâncias; mantido por contrato.)
   */
  async _calculateAdherenceWithProtocols(period, userId /* , protocols */) {
    return this.calculateAdherence(period, userId)
  },

  /**
   * @private Variante de calculateAllProtocolsAdherence com protocols pré-carregados.
   */
  async _calculateAllProtocolsAdherenceWithProtocols(period, userId /* , protocols */) {
    return this.calculateAllProtocolsAdherence(period, userId)
  },

  /**
   * @private Variante de getCurrentStreak com protocols pré-carregados.
   */
  async _getCurrentStreakWithProtocols(userId /* , protocols */) {
    return this.getCurrentStreak(userId)
  },
}

export default adherenceService
