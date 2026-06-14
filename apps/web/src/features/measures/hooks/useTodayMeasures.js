// useTodayMeasures.js — medidas do dia de hoje no web (012 Fase C · ADR-060).
// Alimenta o card "Última medida" do Dashboard (fim da agenda) + nudge de dia vazio.
// Query por limites do dia local no fuso (espelha o fix mobile: sem helper inexistente).

import { useState, useEffect, useCallback } from 'react'
import { measuresRepo } from '@features/measures/services/measuresRepo'
import { getTodayLocal, getStartOfDayISO, getEndOfDayISO } from '@utils/dateUtils'

export function useTodayMeasures(tz = 'America/Sao_Paulo') {
  const [items, setItems] = useState([])

  const load = useCallback(async () => {
    try {
      const today = getTodayLocal(tz)
      const fromTs = getStartOfDayISO(today, tz)
      const toTs = getEndOfDayISO(today, tz)
      const rows = await measuresRepo.list({ fromTs, toTs })
      setItems(rows)
    } catch (err) {
      console.error('[useTodayMeasures]', err?.message)
    }
  }, [tz])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Recarrega quando uma medida é salva em qualquer superfície (FAB global no App).
  useEffect(() => {
    window.addEventListener('mr:measure-saved', load)
    return () => window.removeEventListener('mr:measure-saved', load)
  }, [load])

  return { items, latest: items[0] ?? null, refresh: load }
}
