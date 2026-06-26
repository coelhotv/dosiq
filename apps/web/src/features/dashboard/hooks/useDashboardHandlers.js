import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { cachedLogService as logService } from '@shared/services'
import { analyticsService } from '@dashboard/services/analyticsService'
import { protocolService } from '@features/protocols/services/protocolService'
import { dismissSuggestion } from '@features/protocols/services/reminderOptimizerService'
import { errorLog } from '@shared/utils/logger'
import { getNow, getServerTimestamp } from '@utils/dateUtils'

/**
 * useDashboardHandlers - Hook para gerenciar handlers do dashboard
 */
/** Mensagem amigável para falha de registro 1-click (012 Fase B — smoke PO). */
function friendlyRegisterError(err) {
  const msg = String(err?.message || '')
  if (msg.includes('Estoque insuficiente')) {
    return 'Estoque insuficiente para registrar esta dose. Reponha o estoque ou registre pela tela de doses para ajustar a quantidade.'
  }
  if (msg.includes('Dose muito pequena')) {
    return 'Dose muito pequena para débito de estoque — confira a densidade (gotas/UI por ml) do medicamento.'
  }
  return 'Não foi possível registrar a dose. Tente novamente.'
}

export function useDashboardHandlers({ refresh, reminderSuggestionData, protocols, setDismissedSuggestionId }) {
  // Erro de ação 1-click (Tomar/Confirmar agora): antes morria num throw sem
  // consumidor — usuário clicava e nada acontecia (smoke PO 2026-06-11).
  const [actionError, setActionError] = useState(null)
  const errorTimerRef = useRef(null)
  // Ordem canônica de hooks (States → Memos → Effects → Handlers): cleanup do
  // timer antes dos handlers, sem dependência deles.
  useEffect(() => () => clearTimeout(errorTimerRef.current), [])
  const showActionError = useCallback((err) => {
    setActionError(friendlyRegisterError(err))
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setActionError(null), 8000)
  }, [])
  const clearActionError = useCallback(() => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    setActionError(null)
  }, [])

  // Registra dose DIRETAMENTE sem modal (1-click experience)
  const handleRegisterDoseQuick = useCallback(
    async (medicineId, protocolId, dosagePerIntake, instanceId = null) => {
      try {
        await logService.create(
          {
            medicine_id: medicineId,
            protocol_id: protocolId,
            quantity_taken: dosagePerIntake,
            taken_at: getServerTimestamp(),
          },
          { instanceId }
        )
        analyticsService.track('dose_registered_quick', {
          timestamp: getNow().getTime(),
          method: 'priority-card',
        })
        refresh()
      } catch (err) {
        errorLog('useDashboardHandlers', 'Erro ao registrar dose:', err)
        showActionError(err)
      }
    },
    [refresh, showActionError]
  )

  // Registra múltiplas doses em batch (PriorityDoseCard com 2+ doses)
  const handleRegisterDosesAll = useCallback(
    async (doses) => {
      if (!doses || doses.length === 0) return
      try {
        for (const dose of doses) {
          await logService.create(
            {
              medicine_id: dose.medicineId,
              protocol_id: dose.protocolId,
              quantity_taken: dose.dosagePerIntake,
              taken_at: getServerTimestamp(),
            },
            { instanceId: dose.instanceId ?? null }
          )
        }
        analyticsService.track('doses_registered_batch', {
          timestamp: getNow().getTime(),
          method: 'priority-card',
          count: doses.length,
        })
        refresh()
      } catch (err) {
        errorLog('useDashboardHandlers', 'Erro ao registrar doses:', err)
        // refresh mesmo no erro parcial: doses já registradas do batch devem refletir
        refresh()
        showActionError(err)
      }
    },
    [refresh, showActionError]
  )

  const handleReminderAccept = useCallback(
    async (newTime) => {
      const protocolId = reminderSuggestionData?.protocolId
      const currentTime = reminderSuggestionData?.suggestion?.currentTime
      if (protocolId && newTime && currentTime) {
        // Atualiza time_schedule: substitui horário antigo pelo sugerido
        const protocol = protocols?.find((p) => p.id === protocolId)
        const currentSchedule = protocol?.time_schedule ?? []
        const updatedSchedule = currentSchedule.map((t) => (t === currentTime ? newTime : t))
        
        const finalSchedule = updatedSchedule.includes(newTime)
          ? updatedSchedule
          : [...updatedSchedule, newTime]
        
        try {
          await protocolService.update(protocolId, { time_schedule: finalSchedule })
        } catch (err) {
          errorLog('DashboardHandlers', 'Erro ao atualizar horário do protocolo:', err)
        }
      }
      
      if (protocolId) {
        dismissSuggestion(protocolId, false)
        setDismissedSuggestionId(protocolId)
      }
      refresh()
    },
    [refresh, reminderSuggestionData, protocols, setDismissedSuggestionId]
  )

  return useMemo(() => ({
    handleRegisterDoseQuick,
    handleRegisterDosesAll,
    handleReminderAccept,
    actionError,
    clearActionError
  }), [handleRegisterDoseQuick, handleRegisterDosesAll, handleReminderAccept, actionError, clearActionError])
}
