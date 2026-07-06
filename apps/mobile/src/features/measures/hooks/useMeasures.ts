// useMeasures.js — carrega/escreve biomarcadores (012 Fase C · ADR-060).
// Lista por tipo, cria/edita/exclui via measuresRepo (CRUD completo — US3b).

import { useState, useEffect, useCallback, startTransition } from 'react'
import { addDays, getRawNow } from '@dosiq/core'
import { measuresRepo } from '../services/measuresRepo'

/**
 * @param {Object} [opts]
 * @param {string} [opts.type] - filtra por tipo (glicemia/peso/...).
 * @param {number} [opts.days] - janela em dias (default 90) p/ histórico + tendência.
 */
export function useMeasures({ type, days = 90 }: { type?: string; days?: number } = {}) {
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

  useEffect(() => { startTransition(() => { load() }) }, [load])

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
