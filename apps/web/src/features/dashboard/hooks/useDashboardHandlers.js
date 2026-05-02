import { useCallback, useMemo } from 'react'
import { cachedLogService as logService } from '@shared/services'
import { analyticsService } from '@dashboard/services/analyticsService'
import { protocolService } from '@features/protocols/services/protocolService'
import { dismissSuggestion } from '@features/protocols/services/reminderOptimizerService'
import { errorLog } from '@shared/utils/logger'
import { getNow, getServerTimestamp } from '@utils/dateUtils'

/**
 * useDashboardHandlers - Hook para gerenciar handlers do dashboard
 */
export function useDashboardHandlers({ refresh, reminderSuggestionData, protocols, setSnoozedAlerts, setDismissedSuggestionId }) {
  // Registra dose DIRETAMENTE sem modal (1-click experience)
  const handleRegisterDoseQuick = useCallback(
    async (medicineId, protocolId, dosagePerIntake) => {
      try {
        await logService.create({
          medicine_id: medicineId,
          protocol_id: protocolId,
          quantity_taken: dosagePerIntake,
          taken_at: getServerTimestamp(),
        })
        analyticsService.track('dose_registered_quick', {
          timestamp: getNow().getTime(),
          method: 'priority-card',
        })
        refresh()
      } catch (err) {
        errorLog('useDashboardHandlers', 'Erro ao registrar dose:', err)
        throw err
      }
    },
    [refresh]
  )

  // Registra múltiplas doses em batch (PriorityDoseCard com 2+ doses)
  const handleRegisterDosesAll = useCallback(
    async (doses) => {
      if (!doses || doses.length === 0) return
      try {
        for (const dose of doses) {
          await logService.create({
            medicine_id: dose.medicineId,
            protocol_id: dose.protocolId,
            quantity_taken: dose.dosagePerIntake,
            taken_at: getServerTimestamp(),
          })
        }
        analyticsService.track('doses_registered_batch', {
          timestamp: getNow().getTime(),
          method: 'priority-card',
          count: doses.length,
        })
        refresh()
      } catch (err) {
        errorLog('useDashboardHandlers', 'Erro ao registrar doses:', err)
        throw err
      }
    },
    [refresh]
  )

  const handleSnoozeAlert = useCallback((alertId) => {
    setSnoozedAlerts((prev) => ({ ...prev, [alertId]: true }))
  }, [setSnoozedAlerts])

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
    handleSnoozeAlert,
    handleReminderAccept
  }), [handleRegisterDoseQuick, handleRegisterDosesAll, handleSnoozeAlert, handleReminderAccept])
}
