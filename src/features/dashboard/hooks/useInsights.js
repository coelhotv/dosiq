import { useState, useEffect } from 'react'
import { selectBestInsight } from '@dashboard/services/insightService'

/**
 * Hook para obter insights contextuais para o usuário
 *
 * @param {Object} params - Parâmetros de dados do usuário
 * @param {Object} params.stats - Estatísticas de adesão
 * @param {Array} params.dailyAdherence - Dados de adesão diária
 * @param {Array} params.stockSummary - Resumo de estoque
 * @param {Array} params.logs - Logs de doses
 * @param {Function} params.onNavigate - Função de navegação
 * @returns {Object} - Insight selecionado
 */
export function useInsights({ stats, dailyAdherence, stockSummary, logs, onNavigate }) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    function generateInsight() {
      try {
        setLoading(true)

        // DEBUG: Log context data being passed
        console.log('[useInsights] Context data:', {
          stats,
          dailyAdherence: dailyAdherence?.length || 0,
          stockSummary: stockSummary?.length || 0,
          logs: logs?.length || 0,
          hasOnNavigate: !!onNavigate,
        })

        const selectedInsight = selectBestInsight({
          stats,
          dailyAdherence,
          stockSummary,
          logs,
          onNavigate,
        })

        // DEBUG: Log selected insight
        console.log('[useInsights] Selected insight:', selectedInsight)

        if (isMounted) {
          setInsight(selectedInsight)
          setError(null)
        }
      } catch (err) {
        console.error('[useInsights] Erro ao gerar insight:', err)
        if (isMounted) {
          setError(err.message)
          // Fallback para insight padrão
          setInsight({
            id: 'default',
            type: 'IMPROVEMENT_OPPORTUNITY',
            priority: 'info',
            icon: '💡',
            text: 'Continue registrando suas doses para manter o controle do seu tratamento.',
            highlight: '',
            actionLabel: 'Saiba mais',
            onAction: () => onNavigate?.('help'),
          })
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    generateInsight()

    return () => {
      isMounted = false
    }
  }, [stats, dailyAdherence, stockSummary, logs, onNavigate])

  return {
    insight,
    loading,
    error,
  }
}

export default useInsights
