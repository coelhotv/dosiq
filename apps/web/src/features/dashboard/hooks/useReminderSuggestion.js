import { 
  analyzeReminderTiming, 
  isSuggestionDismissed 
} from '@features/protocols/services/reminderOptimizerService'

/**
 * useReminderSuggestion - Hook para computar sugestões de lembretes
 * 
 * @param {Array} protocols - Lista de protocolos
 * @param {Array} logs - Lista de logs
 * @param {string} dismissedSuggestionId - ID da sugestão dispensada na sessão
 * @returns {object|null} Dados da sugestão
 */
export function useReminderSuggestion(protocols, logs, dismissedSuggestionId) {
  if (!protocols?.length || !logs?.length) return null
  
  for (const protocol of protocols) {
    if (!protocol.active) continue
    if (protocol.id === dismissedSuggestionId) continue
    if (isSuggestionDismissed(protocol.id)) continue
    
    const suggestion = analyzeReminderTiming({ protocol, logs })
    if (suggestion?.shouldSuggest) {
      return {
        suggestion,
        protocolId: protocol.id,
        protocolName: protocol.medicine?.name || protocol.name || '',
      }
    }
  }
  
  return null
}
