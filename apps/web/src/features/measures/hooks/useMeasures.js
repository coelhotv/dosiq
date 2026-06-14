// useMeasures.js — carrega/escreve biomarcadores no web (012 Fase C · ADR-060).
// Espelho do hook mobile: lista por tipo (janela de dias p/ histórico + tendência),
// CRUD completo (US3b). Datas via core (R-020): sem new Date() local.

import { useState, useEffect, useCallback } from 'react'
import { addDays, getRawNow } from '@dosiq/core'
import { measuresRepo } from '@features/measures/services/measuresRepo'

/**
 * @param {Object} [opts]
 * @param {string} [opts.type] - filtra por tipo (glicemia/peso/...).
 * @param {number} [opts.days=90] - janela em dias p/ histórico + tendência.
 */
export function useMeasures({ type, days = 90 } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const fromTs = addDays(getRawNow(), -days).toISOString()
      const data = await measuresRepo.list({ type, fromTs })
      setItems(data)
    } catch (err) {
      setError(err?.message || 'Erro ao carregar medidas')
      console.error('[useMeasures] load:', err)
    } finally {
      setLoading(false)
    }
  }, [type, days])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Recarrega quando uma medida é salva/editada/excluída em qualquer superfície
  // (ex.: card do dia no histórico) — mantém a tendência (ScatterTrend) sincronizada.
  useEffect(() => {
    window.addEventListener('mr:measure-saved', load)
    return () => window.removeEventListener('mr:measure-saved', load)
  }, [load])

  const create = useCallback(async (biomarker) => {
    const created = await measuresRepo.create(biomarker)
    await load()
    return created
  }, [load])

  const update = useCallback(async (id, patch) => {
    const updated = await measuresRepo.update(id, patch)
    await load()
    return updated
  }, [load])

  const remove = useCallback(async (id) => {
    await measuresRepo.remove(id)
    await load()
  }, [load])

  return { items, loading, error, refresh: load, create, update, remove }
}
