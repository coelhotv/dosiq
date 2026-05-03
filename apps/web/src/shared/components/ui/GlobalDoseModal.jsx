// src/shared/components/ui/GlobalDoseModal.jsx
// Modal global de registro de dose — disponível em todas as views via App.jsx

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import {
  cachedLogService as logService,
  cachedTreatmentPlanService as treatmentPlanService,
} from '@shared/services'
import Modal from './Modal'
import LogForm from '@shared/components/log/LogForm'

/**
 * Modal global de registro de dose.
 * Deve ser renderizado DENTRO de DashboardProvider para acessar useDashboard().
 * Dispara evento 'mr:dose-saved' após salvar, para que views subscribed possam recarregar.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controla visibilidade do modal
 * @param {Function} props.onClose - Callback para fechar o modal
 */
export default function GlobalDoseModal({ isOpen, onClose, initialValues = null }) {
  const { protocols, refresh } = useDashboard()
  const [treatmentPlans, setTreatmentPlans] = useState([])
  const [plansError, setPlansError] = useState(null)

  // Busca planos completos com protocolos e medicamentos embarcados
  useEffect(() => {
    if (!isOpen) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlansError(null)

    treatmentPlanService
      .getAll()

      .then(setTreatmentPlans)
      .catch((err) => {
        console.error('[GlobalDoseModal] Erro ao carregar planos de tratamento:', err)
        setPlansError('Não foi possível carregar os planos de tratamento.')
        setTreatmentPlans([])
      })
  }, [isOpen])

  const handleSave = useCallback(
    async (logData) => {
      if (Array.isArray(logData)) {
        await logService.createBulk(logData)
      } else {
        await logService.create(logData)
      }
      refresh()
      window.dispatchEvent(new CustomEvent('mr:dose-saved'))
      onClose()
    },
    [refresh, onClose]
  )

  // Filtros para garantir que apenas tratamentos ativos apareçam no formulário
  const activeProtocols = useMemo(() => protocols.filter((p) => p.active), [protocols])
  const activeTreatmentPlans = useMemo(
    () => treatmentPlans.filter((plan) => plan.protocols?.some((p) => p.active)),
    [treatmentPlans]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {plansError && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          {plansError}
        </p>
      )}
      <LogForm
        protocols={activeProtocols}
        treatmentPlans={activeTreatmentPlans}
        initialValues={initialValues}
        onSave={handleSave}
        onCancel={onClose}
      />
    </Modal>
  )
}
