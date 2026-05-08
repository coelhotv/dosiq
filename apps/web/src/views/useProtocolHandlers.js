/**
 * useProtocolHandlers — Handlers de CRUD para a view Protocols.
 */
import { useCallback } from 'react'
import { protocolService, treatmentPlanService } from '@shared/services'

export function useProtocolHandlers({
  medicines,
  editingProtocol,
  editingPlan,
  onClearParams,
  onNavigateToStock,
  setError,
  setIsModalOpen,
  setIsPlanModalOpen,
  setEditingProtocol,
  setEditingPlan,
  showSuccess,
  loadData,
}) {
  const handleCloseProtocol = useCallback(() => {
    setIsModalOpen(false)
    setEditingProtocol(null)
    if (onClearParams) onClearParams()
  }, [setIsModalOpen, setEditingProtocol, onClearParams])

  const handleClosePlan = useCallback(() => {
    setIsPlanModalOpen(false)
    setEditingPlan(null)
  }, [setIsPlanModalOpen, setEditingPlan])

  const handleAdd = useCallback(() => {
    if (medicines.length === 0) { setError('Cadastre um medicamento antes de criar protocolos'); return }
    setEditingProtocol(null)
    setIsModalOpen(true)
  }, [medicines.length, setError, setEditingProtocol, setIsModalOpen])

  const handleAddPlan = useCallback(() => { setEditingPlan(null); setIsPlanModalOpen(true) }, [setEditingPlan, setIsPlanModalOpen])
  const handleEdit = useCallback((protocol) => { setEditingProtocol(protocol); setIsModalOpen(true) }, [setEditingProtocol, setIsModalOpen])
  const handleEditPlan = useCallback((plan) => { setEditingPlan(plan); setIsPlanModalOpen(true) }, [setEditingPlan, setIsPlanModalOpen])

  const handleSave = useCallback(async (protocolData) => {
    try {
      if (editingProtocol) {
        await protocolService.update(editingProtocol.id, protocolData)
        showSuccess('Protocolo atualizado com sucesso!')
      } else {
        await protocolService.create(protocolData)
        showSuccess('Protocolo criado com sucesso!')
        if (window.confirm('Protocolo criado! Deseja adicionar o estoque inicial deste medicamento agora?')) {
          onNavigateToStock(protocolData.medicine_id)
        }
      }
      handleCloseProtocol()
      await loadData()
    } catch (err) {
      throw new Error('Erro ao salvar protocolo: ' + err.message)
    }
  }, [editingProtocol, showSuccess, onNavigateToStock, handleCloseProtocol, loadData])

  const handleSavePlan = useCallback(async (planData) => {
    try {
      if (editingPlan) {
        await treatmentPlanService.update(editingPlan.id, planData)
        showSuccess('Plano de tratamento atualizado!')
      } else {
        await treatmentPlanService.create(planData)
        showSuccess('Plano de tratamento criado!')
      }
      handleClosePlan()
      await loadData()
    } catch (err) {
      throw new Error('Erro ao salvar plano: ' + err.message)
    }
  }, [editingPlan, showSuccess, handleClosePlan, loadData])

  const handleToggleActive = useCallback(async (protocol) => {
    try {
      await protocolService.update(protocol.id, { active: !protocol.active })
      showSuccess(`Protocolo ${!protocol.active ? 'ativado' : 'pausado'} com sucesso!`)
      await loadData()
    } catch (err) {
      setError('Erro ao atualizar protocolo: ' + err.message)
      console.error(err)
    }
  }, [showSuccess, loadData, setError])

  const handleDelete = useCallback(async (protocol) => {
    if (!window.confirm(`Tem certeza que deseja excluir o protocolo "${protocol.name}"?`)) return
    try {
      await protocolService.delete(protocol.id)
      showSuccess('Protocolo excluído com sucesso!')
      await loadData()
    } catch (err) {
      setError('Erro ao excluir protocolo: ' + err.message)
      console.error(err)
    }
  }, [showSuccess, loadData, setError])

  const handleDeletePlan = useCallback(async (plan) => {
    if (!window.confirm(`Tem certeza que deseja excluir o plano "${plan.name}" e desvincular seus remédios?`)) return
    try {
      await treatmentPlanService.delete(plan.id)
      showSuccess('Plano excluído com sucesso!')
      await loadData()
    } catch (err) {
      setError('Erro ao excluir plano: ' + err.message)
      console.error(err)
    }
  }, [showSuccess, loadData, setError])

  return {
    handleAdd,
    handleAddPlan,
    handleEdit,
    handleEditPlan,
    handleSave,
    handleSavePlan,
    handleToggleActive,
    handleDelete,
    handleDeletePlan,
    handleCloseProtocol,
    handleClosePlan,
  }
}
