// useTodayMeasures.js — medidas do DIA local p/ interleave na Agenda de Hoje (012 Fase C · FR-011).
// Janela = bounds do dia local (start/end ISO UTC) → query no banco já filtra o dia certo.
// refresh() reusado no save (speed-dial) e no foco da tela → timeline atualiza ao registrar.

import { useState, useEffect, useCallback, startTransition } from 'react'
import { getTodayLocal, getStartOfDayISO, getEndOfDayISO } from '@dosiq/core'
import { measuresRepo } from '../services/measuresRepo'

export function useTodayMeasures(tz = 'America/Sao_Paulo') {
  const [items, setItems] = useState([])

  const load = useCallback(async () => {
    try {
      const today = getTodayLocal(tz)
      const fromTs = getStartOfDayISO(today, tz)
      const toTs = getEndOfDayISO(today, tz)
      const rows = await measuresRepo.list({ fromTs, toTs })
      startTransition(() => setItems(rows))
    } catch (err) {
      // interleave é opcional — falha silenciosa não quebra a agenda
      if (__DEV__) console.warn('[useTodayMeasures]', err?.message)
    }
  }, [tz])

  useEffect(() => { startTransition(() => { load() }) }, [load])

  return { items, refresh: load }
}
