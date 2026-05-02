import { AnalyzeReminderTimingInputSchema } from '@schemas/reminderOptimizerSchema'
import { getNow, parseISO } from '@utils/adherenceLogic'

/**
 * Analisa delta entre horário programado e horário real de tomada.
 * Se o paciente consistentemente toma em horário diferente, sugere ajuste.
 *
 * @param {Object} params
 * @param {Object} params.protocol - Protocolo com time_schedule
 * @param {Array} params.logs - Logs de dose para este protocolo
 * @returns {{
 *   shouldSuggest: boolean,
 *   currentTime: string,       // HH:MM programado
 *   suggestedTime: string,     // HH:MM sugerido
 *   avgDeltaMinutes: number,   // Delta médio em minutos
 *   sampleCount: number,       // Quantas amostras usadas
 *   direction: 'later'|'earlier'
 * } | null}
 */
export function analyzeReminderTiming({ protocol, logs }) {
  // Validação obrigatória com Zod
  const validationResult = AnalyzeReminderTimingInputSchema.safeParse({
    protocol,
    logs,
  })

  if (!validationResult.success) {
    // R-087: Structured Logging para debugging
    const issues = validationResult.error.issues
    const fieldErrors = issues.reduce((acc, issue) => {
      const path = issue.path.join('.')
      if (!acc[path]) acc[path] = []
      acc[path].push({ code: issue.code, message: issue.message })
      return acc
    }, {})

    console.error('[reminderOptimizerService] Validation failed:', {
      timestamp: getNow().toISOString(),
      context: 'analyzeReminderTiming',
      protocol_id: protocol?.id,
      logs_count: logs?.length,
      error_by_field: fieldErrors,
      first_log_sample: logs?.[0],
      first_issue_details: issues[0],
    })
    return null
  }

  const { protocol: validProtocol, logs: validLogs } = validationResult.data

  // Guardar clauses: sem time_schedule ou frequency inválida
  if (!validProtocol.time_schedule || validProtocol.time_schedule.length === 0) {
    return null
  }

  if (validProtocol.frequency === 'quando_necessario') {
    return null
  }

  // Otimização: Pré-processa os logs uma única vez para evitar parsing repetido
  const processedLogs = validLogs
    .map((log) => {
      const logDate = parseISO(log.taken_at)
      if (isNaN(logDate.getTime())) return null // Ignora datas inválidas
      return {
        ...log,
        logMinutes: logDate.getHours() * 60 + logDate.getMinutes(),
      }
    })
    .filter(Boolean)

  const suggestions = []

  // Analisar cada horário programado
  for (const scheduledTime of validProtocol.time_schedule) {
    const [scheduledH, scheduledM] = scheduledTime.split(':').map(Number)
    const scheduledMinutes = scheduledH * 60 + scheduledM

    // Filtrar logs relevantes para este horário (dentro de 4h window)
    const relevantLogs = processedLogs.filter((log) => {
      // Apenas logs que correspondem ao ID do protocolo, ou que não têm ID de protocolo mas correspondem ao ID do medicamento.
      const isMatch =
        log.protocol_id === validProtocol.id ||
        (log.protocol_id == null && log.medicine_id === validProtocol.medicine_id)

      if (!isMatch) {
        return false
      }

      const delta = Math.abs(log.logMinutes - scheduledMinutes)
      return delta < 240 // Dentro de 4h do horário programado
    })

    // Amostras insuficientes (< 10)
    if (relevantLogs.length < 10) {
      continue
    }

    // Calcular delta médio
    const deltas = relevantLogs.map((log) => log.logMinutes - scheduledMinutes)

    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length

    // Sugerir apenas se |avgDelta| > 30 minutos
    if (Math.abs(avgDelta) <= 30) {
      continue
    }

    // Arredondar para 15 minutos
    const suggestedMinutes = scheduledMinutes + Math.round(avgDelta / 15) * 15
    const suggestedH = Math.floor(suggestedMinutes / 60) % 24
    const suggestedM = suggestedMinutes % 60
    const suggestedTime = `${String(suggestedH).padStart(2, '0')}:${String(suggestedM).padStart(2, '0')}`

    suggestions.push({
      shouldSuggest: true,
      currentTime: scheduledTime,
      suggestedTime,
      avgDeltaMinutes: Math.round(avgDelta),
      sampleCount: relevantLogs.length,
      direction: avgDelta > 0 ? 'later' : 'earlier',
    })
  }

  return suggestions.length > 0 ? suggestions[0] : null // Uma sugestão por vez
}

/**
 * Verifica se a sugestão já foi dispensada pelo usuário.
 * @param {string} protocolId
 * @returns {boolean}
 */
export function isSuggestionDismissed(protocolId) {
  // Guard clause: ambiente server-side sem window (AP-T03)
  if (typeof window === 'undefined') {
    return true
  }
  // Guard clause: localStorage indisponivel em ambiente de teste/SSR (AP-T03)
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    return false
  }

  const key = `optimizer_dismissed_${protocolId}`
  const dismissed = localStorage.getItem(key)

  if (!dismissed) {
    return false
  }

  try {
    const { timestamp, permanent } = JSON.parse(dismissed)

    if (permanent) {
      return true
    }

    // Dispensado por 30 dias
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    return getNow().getTime() - timestamp < thirtyDaysMs
  } catch (error) {
    console.error('[reminderOptimizerService] Error parsing dismissed suggestion:', error)
    return true
  }
}

/**
 * Registra dispensa da sugestão.
 * @param {string} protocolId
 * @param {boolean} permanent - Se true, nunca mais sugerir
 */
export function dismissSuggestion(protocolId, permanent = false) {
  // Guard clause: ambiente não-browser ou localStorage indisponivel (AP-T03)
  if (
    typeof window === 'undefined' ||
    typeof localStorage === 'undefined' ||
    typeof localStorage.setItem !== 'function'
  ) {
    console.warn('[reminderOptimizerService] dismissSuggestion called in non-browser environment')
    return
  }

  const key = `optimizer_dismissed_${protocolId}`
  const value = JSON.stringify({
    timestamp: getNow().getTime(),
    permanent,
  })

  try {
    localStorage.setItem(key, value)
    console.log('[reminderOptimizerService] Suggestion dismissed:', {
      protocolId,
      key,
      permanent,
      timestamp: getNow().toISOString(),
      storageSize: Object.keys(localStorage).length,
    })
  } catch (error) {
    console.error('[reminderOptimizerService] Failed to dismiss suggestion:', {
      protocolId,
      key,
      error: error.message,
      timestamp: getNow().toISOString(),
    })
  }
}
