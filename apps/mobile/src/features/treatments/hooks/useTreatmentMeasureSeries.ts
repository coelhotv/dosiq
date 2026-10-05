// useTreatmentMeasureSeries.ts — estado do card "Peso durante o tratamento" (spec 069 Bb · T050).
//
// B-4 carregando · B-5 erro (`network` × `other`, via isNetworkError — E-B4, sem classificador novo)
// · dados `{ series, state }` da ponte do core. Recarrega a cada foco e após salvar um peso.
// Guarda de corrida por reqId (padrão useTitrationTimeline): resposta velha nunca sobrescreve a nova.
//
// Emite `measure_series_viewed` com o estado FINAL (nunca no carregando): 1× por foco, e 1× após
// salvar só se o estado mudou (RC3 E-B5). Nunca valor, média ou diferença (§6).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import type { MeasureSeriesState } from '@dosiq/core'
import { isNetworkError } from '@shared/utils/networkError'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import {
  loadTreatmentMeasureSeries,
  type TreatmentMeasureProtocol,
  type TreatmentMeasureResult,
} from '../services/treatmentMeasureService'

export type MeasureSeriesError = 'network' | 'other'

type LoadCause = 'focus' | 'save' | 'retry'

const VIEWED_STATE: Record<MeasureSeriesState, string> = {
  B0: 'chart',
  B1: 'missing_count',
  B2: 'missing_time',
  B3: 'missing_both',
}

export function useTreatmentMeasureSeries(protocol: TreatmentMeasureProtocol | null | undefined) {
  // States
  const [data, setData] = useState<TreatmentMeasureResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<MeasureSeriesError | null>(null)
  const reqIdRef = useRef(0)
  const protocolRef = useRef(protocol)
  const lastViewedRef = useRef<string | null>(null)

  // Chave estável: o detalhe recarrega o protocolo a cada foco (objeto novo); só os campos que a
  // série lê disparam nova leitura fora do foco.
  const key = protocol
    ? [protocol.id, protocol.start_date, protocol.frequency, protocol.medicine_id, protocol.dosage_per_intake].join('|')
    : null

  // Handlers
  const load = useCallback(
    async (cause: LoadCause) => {
      const myReq = ++reqIdRef.current
      const current = protocolRef.current
      if (!current) return
      setLoading(true)
      let viewedState: string
      let stepCount = 0
      try {
        const result = await loadTreatmentMeasureSeries(current)
        if (myReq !== reqIdRef.current) return
        setData(result)
        setError(null)
        if (!result) return
        viewedState = VIEWED_STATE[result.state]
        stepCount = result.series.steps.length
      } catch (err) {
        if (myReq !== reqIdRef.current) return
        setError(isNetworkError(err) ? 'network' : 'other')
        viewedState = 'error'
      } finally {
        if (myReq === reqIdRef.current) setLoading(false)
      }
      if (cause === 'save' && viewedState === lastViewedRef.current) return
      lastViewedRef.current = viewedState
      void logEvent(EVENTS.MEASURE_SERIES_VIEWED, {
        biomarker_type: 'peso',
        state: viewedState,
        step_count: stepCount,
        treatment_id: current.id,
        surface: SURFACES.MOBILE,
      })
    },
    // key: relê quando o que a série depende muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  )

  // Effects — o ref acompanha o protocolo ANTES do efeito de foco (efeitos rodam na ordem declarada).
  useEffect(() => {
    protocolRef.current = protocol
  }, [protocol])

  useFocusEffect(
    useCallback(() => {
      load('focus').catch(() => {})
    }, [load])
  )

  const refreshAfterSave = useCallback(() => load('save').catch(() => {}), [load])
  const retry = useCallback(() => load('retry').catch(() => {}), [load])

  return { data, loading, error, refreshAfterSave, retry }
}
