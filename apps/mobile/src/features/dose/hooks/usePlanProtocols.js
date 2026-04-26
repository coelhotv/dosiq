// usePlanProtocols.js — hook para carregar protocolos de um bloco semântico
// Reutiliza treatmentsService.getActiveTreatments e filtra por planId ou protocolIds[]

import { useState, useEffect } from 'react'
import { getActiveTreatments } from '../../treatments/services/treatmentsService'

/**
 * Carrega os protocolos ativos correspondentes a um bloco de notificação.
 *
 * @param {{ mode: 'plan'|'misc', planId?: string, protocolIds?: string[], userId: string }} params
 * @returns {{ protocols: Object[], loading: boolean, error: string|null }}
 */
export function usePlanProtocols({ mode, planId, protocolIds, userId }) {
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    if (mode === 'plan' && !planId) return
    if (mode === 'misc' && (!protocolIds || protocolIds.length === 0)) return

    let isMounted = true
    setLoading(true)
    setError(null)

    getActiveTreatments(userId)
      .then(result => {
        if (!isMounted) return
        if (!result.success) {
          setError(result.error ?? 'Erro ao carregar protocolos.')
          return
        }
        const all = result.data ?? []
        if (mode === 'plan') {
          setProtocols(all.filter(p => p.treatment_plan?.id === planId))
        } else {
          setProtocols(all.filter(p => protocolIds.includes(p.id)))
        }
      })
      .catch(err => {
        if (!isMounted) return
        setError(err.message ?? 'Erro desconhecido.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [mode, planId, protocolIds, userId])

  return { protocols, loading, error }
}
