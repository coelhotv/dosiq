// usePlanProtocols.js — hook para carregar protocolos de um bloco semântico
// Reutiliza treatmentsService.getActiveTreatments e filtra por planId ou protocolIds[]

import { useState, useEffect } from 'react'
import { isTreatmentSchedulableOn, getTodayLocal } from '@dosiq/core'
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
 * @param {{ mode: 'plan'|'misc'|'active', planId?: string, protocolIds?: string[], scheduledTime?: string, userId: string }} params
 * @returns {{ protocols: Object[], loading: boolean, error: string|null }}
 */
export function usePlanProtocols({ mode, planId = undefined, protocolIds = undefined, scheduledTime = undefined, userId }) {
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Ajuste de Estado no Render (React 19 Pattern) para evitar cascading renders no useEffect
  const [prevKey, setPrevKey] = useState('')
  const currentKey = `${userId}-${mode}-${planId}-${(protocolIds || []).join(',')}`
  
  if (currentKey !== prevKey) {
    setPrevKey(currentKey)
    const hasRequiredParams = mode === 'active' || (mode === 'plan' ? !!planId : (protocolIds || []).length > 0)
    if (userId && userId !== 'demo-user' && hasRequiredParams) {
      setLoading(true)
      setError(null)
    }
  }

  useEffect(() => {
    if (!userId || userId === 'demo-user') return
    if (mode === 'plan' && !planId) return
    if (mode === 'misc' && (!protocolIds || protocolIds.length === 0)) return

    let isMounted = true

    getActiveTreatments(userId)
      .then(result => {
        if (!isMounted) return
        if (!result.success) {
          setError(result.error ?? 'Erro ao carregar protocolos.')
          return
        }
        const all = result.data ?? []
        if (mode === 'plan') {
          // getActiveTreatments é alias de getAllTreatments → traz TODOS os status.
          // Só tratamentos elegíveis HOJE (ativos + dentro do período start/end) entram
          // na modal bulk do plano; senão prescrições encerradas/futuras do mesmo
          // treatment_plan vazam (bug prod 039).
          const todayStr = getTodayLocal()
          setProtocols(
            all
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter(p => (p.treatment_plan as any)?.id === planId)
              .filter(p => isTreatmentSchedulableOn(p, todayStr))
              .filter(p => isInWindow(p, scheduledTime))
          )
        } else if (mode === 'misc') {
          setProtocols(all.filter(p => protocolIds.includes(p.id)))
        } else if (mode === 'active') {
          const todayStr = getTodayLocal()
          setProtocols(
            all.filter(p => isTreatmentSchedulableOn(p, todayStr))
          )
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

