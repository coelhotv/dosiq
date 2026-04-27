// usePlanProtocols.js — hook para carregar protocolos de um bloco semântico
// Reutiliza treatmentsService.getActiveTreatments e filtra por planId ou protocolIds[]

import { useState, useEffect } from 'react'
import { getActiveTreatments } from '../../treatments/services/treatmentsService'

/**
 * Converte "HH:MM" para minutos desde meia-noite.
 */
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Retorna true se o protocolo tem algum horário em time_schedule dentro
 * de uma janela de ±windowMinutes em relação ao horário alvo.
 */
function isInWindow(protocol, scheduledTime, windowMinutes = 120) {
  if (!scheduledTime) return true
  const target = toMinutes(scheduledTime)
  return (protocol.time_schedule ?? []).some(t => Math.abs(toMinutes(t) - target) <= windowMinutes)
}

/**
 * Carrega os protocolos ativos correspondentes a um bloco de notificação,
 * filtrando pela janela de horário (±2h do scheduledTime) quando informado.
 *
 * @param {{ mode: 'plan'|'misc', planId?: string, protocolIds?: string[], scheduledTime?: string, userId: string }} params
 * @returns {{ protocols: Object[], loading: boolean, error: string|null }}
 */
export function usePlanProtocols({ mode, planId, protocolIds, scheduledTime, userId }) {
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
          setProtocols(
            all
              .filter(p => p.treatment_plan?.id === planId)
              .filter(p => isInWindow(p, scheduledTime))
          )
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
  }, [mode, planId, protocolIds, scheduledTime, userId])

  return { protocols, loading, error }
}
