import { useState, useEffect, useMemo } from 'react'
import { getAdherenceTrend, getTrendEmoji, getTrendLabel } from '@shared/services/adherenceTrendService'

/**
 * Hook para obter dados de tendência de adesão
 * 
 * @returns {Object} - { trend, percentage, direction, magnitude, emoji, label, loading, error }
 */
export function useAdherenceTrend() {
  const [trendData, setTrendData] = useState({
    percentage: 0,
    direction: 'neutral',
    magnitude: 0,
    hasPreviousWeek: false
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function fetchTrend() {
      try {
        setLoading(true)
        const data = await getAdherenceTrend(2)

        if (isMounted) {
          setTrendData({
            percentage: data.percentage || 0,
            direction: data.direction || 'neutral',
            magnitude: data.magnitude || 0,
            hasPreviousWeek: data.hasPreviousWeek || false
          })
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Erro ao buscar tendência de adesão:', err)
          setError(err.message)
          setTrendData({
            percentage: 0,
            direction: 'neutral',
            magnitude: 0,
            hasPreviousWeek: false
          })
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchTrend()

    return () => {
      isMounted = false
    }
  }, [])

  const emoji = useMemo(() => 
    getTrendEmoji(trendData.direction, trendData.magnitude),
    [trendData.direction, trendData.magnitude]
  )

  const label = useMemo(() => 
    getTrendLabel(trendData.direction, trendData.percentage),
    [trendData.direction, trendData.percentage]
  )

  return {
    trend: trendData.direction,
    percentage: trendData.percentage,
    magnitude: trendData.magnitude,
    emoji,
    label,
    hasPreviousWeek: trendData.hasPreviousWeek,
    loading,
    error
  }
}

export default useAdherenceTrend
