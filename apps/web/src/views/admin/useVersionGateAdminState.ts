// apps/web/src/views/admin/useVersionGateAdminState.ts
// Estado do painel do kill switch (spec 051-A PR 1.5c, edit-only — RC3-2/F6).
//
// Fluxo de ativação (PO-9 / S-7): 1º submit manda o payload SEM `acknowledge_affected_devices`. O
// handler recusa (409) e devolve a contagem real de devices afetados — guardamos essa contagem como
// `pendingConfirmation` e a TELA a exibe, sem recalcular nada. Confirmar reenvia o MESMO payload com
// `acknowledge_affected_devices` = a contagem que o servidor devolveu. Desativar não passa por essa
// dança (handler não exige acknowledge para `is_active: false`).

import { useState, useEffect, useCallback, startTransition } from 'react'
import { versionGateAdminService } from '@services/api/versionGateAdminService'

function useSubmitAction({ editState, setPendingConfirmation, setRows, setActionLoading, setActionMessage }: any) {
  return useCallback(
    async (platform: string) => {
      setActionLoading(platform)
      setActionMessage(null)
      try {
        const edit = editState[platform] || {}
        const payload = {
          platform,
          is_active: edit.is_active,
          min_supported_version: edit.min_supported_version || null,
          message: edit.message || null,
          store_url: edit.store_url || null,
        }
        const result = await versionGateAdminService.update(payload)

        if (result.confirmationRequired) {
          setPendingConfirmation((prev: any) => ({
            ...prev,
            [platform]: {
              affected_devices: result.affected_devices,
              platform_installs: result.platform_installs,
              fleet_installs: result.fleet_installs,
            },
          }))
          return
        }

        setPendingConfirmation((prev: any) => {
          const next = { ...prev }
          delete next[platform]
          return next
        })
        setRows((prev: any[]) => prev.map((r) => (r.platform === platform ? result.data : r)))
        setActionMessage({ type: 'success', text: `Gate de ${platform} atualizado.` })
      } catch (err: any) {
        setActionMessage({ type: 'error', text: err.message })
      } finally {
        setActionLoading(null)
      }
    },
    [editState, setActionLoading, setActionMessage, setPendingConfirmation, setRows]
  )
}

function useConfirmAction({ editState, pendingConfirmation, setPendingConfirmation, setRows, setActionLoading, setActionMessage }: any) {
  return useCallback(
    async (platform: string) => {
      const pending = pendingConfirmation[platform]
      if (!pending) return

      setActionLoading(platform)
      setActionMessage(null)
      try {
        const edit = editState[platform] || {}
        const payload = {
          platform,
          is_active: edit.is_active,
          min_supported_version: edit.min_supported_version || null,
          message: edit.message || null,
          store_url: edit.store_url || null,
          acknowledge_affected_devices: pending.affected_devices,
        }
        const result = await versionGateAdminService.update(payload)

        if (result.confirmationRequired) {
          setPendingConfirmation((prev: any) => ({
            ...prev,
            [platform]: {
              affected_devices: result.affected_devices,
              platform_installs: result.platform_installs,
              fleet_installs: result.fleet_installs,
            },
          }))
          setActionMessage({
            type: 'error',
            text: 'A contagem de devices mudou desde a última confirmação. Confirme novamente.',
          })
          return
        }

        setPendingConfirmation((prev: any) => {
          const next = { ...prev }
          delete next[platform]
          return next
        })
        setRows((prev: any[]) => prev.map((r) => (r.platform === platform ? result.data : r)))
        setActionMessage({ type: 'success', text: `Gate de ${platform} ativado.` })
      } catch (err: any) {
        setActionMessage({ type: 'error', text: err.message })
      } finally {
        setActionLoading(null)
      }
    },
    [editState, pendingConfirmation, setActionLoading, setActionMessage, setPendingConfirmation, setRows]
  )
}

function useDeactivateAction({ editState, setRows, setEditState, setPendingConfirmation, setActionLoading, setActionMessage }: any) {
  return useCallback(
    async (platform: string) => {
      setActionLoading(platform)
      setActionMessage(null)
      try {
        const edit = editState[platform] || {}
        const payload = {
          platform,
          is_active: false,
          min_supported_version: edit.min_supported_version || null,
          message: edit.message || null,
          store_url: edit.store_url || null,
        }
        const result = await versionGateAdminService.update(payload)
        setRows((prev: any[]) => prev.map((r) => (r.platform === platform ? result.data : r)))
        setEditState((prev: any) => ({ ...prev, [platform]: { ...prev[platform], is_active: false } }))
        setPendingConfirmation((prev: any) => {
          const next = { ...prev }
          delete next[platform]
          return next
        })
        setActionMessage({ type: 'success', text: `Gate de ${platform} desativado.` })
      } catch (err: any) {
        setActionMessage({ type: 'error', text: err.message })
      } finally {
        setActionLoading(null)
      }
    },
    [editState, setActionLoading, setActionMessage, setEditState, setPendingConfirmation, setRows]
  )
}

export function useVersionGateAdminState() {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editState, setEditState] = useState({})
  const [pendingConfirmation, setPendingConfirmation] = useState({})
  const [actionLoading, setActionLoading] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)

  const loadGate = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await versionGateAdminService.getAll()
      setRows(data || [])
      setEditState((prev) => {
        const next = { ...prev }
        for (const row of data || []) {
          if (!next[row.platform]) {
            next[row.platform] = {
              is_active: row.is_active,
              min_supported_version: row.min_supported_version || '',
              message: row.message || '',
              store_url: row.store_url || '',
            }
          }
        }
        return next
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      loadGate()
    })
  }, [loadGate])

  const updateField = useCallback((platform: string, field: string, value: any) => {
    setEditState((prev: any) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }))
    setPendingConfirmation((prev: any) => {
      if (!prev[platform]) return prev
      const next = { ...prev }
      delete next[platform]
      return next
    })
  }, [])

  const submit = useSubmitAction({
    editState,
    setPendingConfirmation,
    setRows,
    setActionLoading,
    setActionMessage,
  })

  const confirm = useConfirmAction({
    editState,
    pendingConfirmation,
    setPendingConfirmation,
    setRows,
    setActionLoading,
    setActionMessage,
  })

  const deactivate = useDeactivateAction({
    editState,
    setRows,
    setEditState,
    setPendingConfirmation,
    setActionLoading,
    setActionMessage,
  })

  const cancelConfirmation = useCallback((platform: string) => {
    setPendingConfirmation((prev: any) => {
      const next = { ...prev }
      delete next[platform]
      return next
    })
  }, [])

  return {
    rows,
    isLoading,
    error,
    editState,
    pendingConfirmation,
    actionLoading,
    actionMessage,
    loadGate,
    updateField,
    submit,
    confirm,
    cancelConfirmation,
    deactivate,
  }
}

export default useVersionGateAdminState
