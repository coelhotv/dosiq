// TreatmentWeightCard — 6 estados do FR-009, faixas por etapa, "Dose atual", link, CTA com entry_point,
// "Ver por etapa" por conta e a11y (069 Bb · PO-6, PO-7, PO-12, PO-18, PO-21).
import { describe, it, expect, afterEach } from '@jest/globals'
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { buildTreatmentMeasureSeries, pickMeasureSeriesState } from '@dosiq/core'

let mockHook: any = {}
jest.mock('../../hooks/useTreatmentMeasureSeries', () => ({ useTreatmentMeasureSeries: () => mockHook }))

jest.mock('lucide-react-native', () => ({
  Ruler: 'Ruler', AlertCircle: 'AlertCircle', ChevronDown: 'ChevronDown', ChevronUp: 'ChevronUp', ChevronRight: 'ChevronRight',
}))

let mockSheetProps: any = null
jest.mock('@measures/components/MeasureLogSheet', () => (props) => {
  mockSheetProps = props
  return null
})

const mockCreate = jest.fn()
jest.mock('@measures/services/measuresRepo', () => ({ measuresRepo: { create: (...a) => mockCreate(...a) } }))

const mockNavigate = jest.fn()
jest.mock('@navigation/navigateCrossTab', () => ({ navigateCrossTab: (...a) => mockNavigate(...a) }))

const mockLog = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: (...a) => mockLog(...a) }))

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }) } },
}))

const mockStorage: Record<string, string> = {}
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k) => Promise.resolve(mockStorage[k] ?? null),
  setItem: (k, v) => {
    mockStorage[k] = v
    return Promise.resolve()
  },
}))

import TreatmentWeightCard from '../TreatmentWeightCard'
import { stepsStorageKey } from '@treatments/utils/weightChartLayout'
import { MEASURE_PROMPT_POLICIES } from '@dose/services/measurePrompt'

const TZ = 'America/Sao_Paulo'
const TODAY = '2026-10-05'
const PROTO = { id: 'p1', medicine_id: 'm1', frequency: 'semanal', intake_unit: 'mg', dosage_per_intake: 5, start_date: '2026-08-01' }
const peso = (day: string, kg: number, hour = '07:00') => ({ type: 'peso', value: kg, measured_at: `${day}T${hour}:00-03:00` })

const LADDER_STEPS = [
  { doseLabel: '2,5 mg', start: '2026-08-01', end: '2026-08-29', current: false },
  { doseLabel: '5 mg', start: '2026-08-29', end: '2026-09-26', current: false },
  { doseLabel: '7,5 mg', start: '2026-09-26', end: null, current: true },
]
const SINGLE_STEP = [{ doseLabel: '5 mg', start: '2026-08-01', end: null, current: true }]

function seriesOf(measures, { steps = LADDER_STEPS, today = TODAY } = {}) {
  const series = buildTreatmentMeasureSeries({
    biomarkerType: 'peso', measures, steps, doseDays: [{ day: '2026-08-08', taken: 1, missed: 0 }],
    timezone: TZ, from: '2026-08-01', to: today,
  })
  return { series, state: pickMeasureSeriesState(series, today), hasLadder: steps.length > 1, today, timezone: TZ }
}

const ready = (data) => ({ data, loading: false, error: null, refreshAfterSave: jest.fn(), retry: jest.fn() })
const B0 = () => seriesOf([peso('2026-08-02', 90), peso('2026-09-01', 88), peso('2026-10-01', 86)])

function layout(utils) {
  fireEvent(utils.getByTestId('weight-plot'), 'layout', { nativeEvent: { layout: { width: 300, height: 180 } } })
}

describe('TreatmentWeightCard', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    mockSheetProps = null
  })

  it('PO-6: 3 pesagens em 14+ dias renderiza gráfico com 1 faixa por etapa', () => {
    mockHook = ready(B0())
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    expect(utils.getByTestId('weight-card-B0')).toBeTruthy()
    expect(utils.getByText('3 pesagens · 2 ago a 1 out · kg')).toBeTruthy()
    layout(utils)
    expect(utils.getAllByTestId('weight-step-band')).toHaveLength(3)
    expect(utils.getAllByTestId('weight-point')).toHaveLength(3)
  })

  it('FR-013: faixa estreita encurta o rótulo para o número e leva a unidade à legenda', () => {
    mockHook = ready(B0())
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    fireEvent(utils.getByTestId('weight-plot'), 'layout', { nativeEvent: { layout: { width: 150, height: 180 } } })
    expect(utils.getByText('Dose em mg')).toBeTruthy()
    expect(utils.queryByText('2,5 mg')).toBeNull()
    fireEvent(utils.getByTestId('weight-plot'), 'layout', { nativeEvent: { layout: { width: 600, height: 180 } } })
    expect(utils.queryByText('Dose em mg')).toBeNull()
    expect(utils.getByText('2,5 mg')).toBeTruthy()
  })

  it('pontos inteiros dentro do plot, inclusive o de hoje na borda direita e o do topo da escala (smoke 05/10)', () => {
    mockHook = ready(seriesOf([peso('2026-08-02', 80), peso('2026-09-01', 82), peso('2026-10-05', 85)]))
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    layout(utils)
    for (const pt of utils.getAllByTestId('weight-point')) {
      const st = Object.assign({}, ...[pt.props.style].flat(Infinity).filter(Boolean))
      expect(st.left).toBeGreaterThanOrEqual(0)
      expect(st.left + st.width).toBeLessThanOrEqual(300)
      expect(st.top).toBeGreaterThanOrEqual(0)
      expect(st.top + st.height).toBeLessThanOrEqual(180)
    }
  })

  it('PO-6: sem titulação: sem faixa e linha "Dose atual"', () => {
    mockHook = ready(seriesOf([peso('2026-08-02', 90), peso('2026-09-01', 88), peso('2026-10-01', 86)], { steps: SINGLE_STEP }))
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    layout(utils)
    expect(utils.queryAllByTestId('weight-step-band')).toHaveLength(0)
    expect(utils.getByText('Dose atual · 5 mg · desde 1 ago')).toBeTruthy()
    expect(utils.queryByText('Ver por etapa')).toBeNull()
  })

  it('PO-6: "Ver todos os pesos" navega para Measures com type peso', () => {
    mockHook = ready(B0())
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    fireEvent.press(utils.getByText('Ver todos os pesos'))
    expect(mockNavigate).toHaveBeenCalledWith('Perfil', 'Measures', { type: 'peso' })
  })

  it('PO-18: só semanal monta o card (mesmo predicado da Fase A); não elegível ⇒ nada', () => {
    const appliesTo = MEASURE_PROMPT_POLICIES.peso.appliesTo
    expect(appliesTo({ protocol: { frequency: 'diário', medicine: { presentation: 'comprimido', dosage_unit: 'mg' } } })).toBe(false)
    expect(appliesTo({ protocol: { frequency: 'semanal', medicine: { presentation: 'comprimido', dosage_unit: 'mg' } } })).toBe(true)
    // R-11 emendada (2026-10-05): injetável não basta — mensal e diário ficam sem card.
    expect(appliesTo({ protocol: { frequency: 'diário', medicine: { presentation: 'injetavel', dosage_unit: 'mg/ml' } } })).toBe(false)
    expect(appliesTo({ protocol: { frequency: 'intervalo_dias', medicine: { presentation: 'injetavel', dosage_unit: 'mg/ml' } } })).toBe(false)
    mockHook = { ...ready(null) }
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    expect(utils.toJSON()).toBeNull()
  })

  // PO-7: os 7 casos — nenhum vazio monta gráfico; cada um diz só o que falta.
  it.each([
    ['0 pesagens → B-3', [], 'B3', 'Nenhum peso registrado', 'Registre o peso em 3 dias diferentes, ao longo de 2 semanas, para ver o gráfico.'],
    ['1 pesagem há 3 dias → B-3 com data', [peso('2026-10-02', 88)], 'B3', 'Faltam 2 pesagens', 'Registre o peso em mais 2 dias diferentes. O gráfico aparece a partir de 16 out.'],
    ['2 pesagens, 1ª há 20 dias → B-1', [peso('2026-09-15', 88), peso('2026-10-01', 87)], 'B1', 'Falta 1 pesagem', 'Registre o peso em mais 1 dia diferente para ver o gráfico.'],
    ['2 pesagens em 5 dias → B-3 com data', [peso('2026-09-30', 88), peso('2026-10-04', 87)], 'B3', 'Falta 1 pesagem', 'Registre o peso em mais 1 dia diferente. O gráfico aparece a partir de 14 out.'],
    ['3 pesagens em 5 dias → B-2', [peso('2026-09-30', 88), peso('2026-10-02', 87), peso('2026-10-04', 87)], 'B2', 'O gráfico aparece em 14 out', 'Registre o peso nesse dia ou depois.'],
    ['2 pesagens no mesmo dia contam 1', [peso('2026-10-02', 88, '07:00'), peso('2026-10-02', 87, '20:00')], 'B3', 'Faltam 2 pesagens', 'Registre o peso em mais 2 dias diferentes. O gráfico aparece a partir de 16 out.'],
  ])('PO-7: %s', (_n, measures, state, title, body) => {
    mockHook = ready(seriesOf(measures))
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    expect(utils.getByTestId(`weight-card-${state}`)).toBeTruthy()
    expect(utils.getByText(title)).toBeTruthy()
    expect(utils.getByText(body)).toBeTruthy()
    expect(utils.queryByTestId('weight-step-chart')).toBeNull()
  })

  it('PO-7: 3 pesagens em 14 dias → B-0 (7º caso)', () => {
    mockHook = ready(seriesOf([peso('2026-09-20', 88), peso('2026-09-27', 87), peso('2026-10-04', 87)]))
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    expect(utils.getByTestId('weight-step-chart')).toBeTruthy()
  })

  it('B-4 skeleton; B-5 erro ≠ vazio, rede × outro, Tentar de novo', () => {
    mockHook = { data: null, loading: true, error: null, retry: jest.fn(), refreshAfterSave: jest.fn() }
    const a = render(<TreatmentWeightCard protocol={PROTO as any} />)
    expect(a.getByTestId('weight-card-skeleton')).toBeTruthy()
    a.unmount()
    const retry = jest.fn()
    mockHook = { data: null, loading: false, error: 'network', retry, refreshAfterSave: jest.fn() }
    const b = render(<TreatmentWeightCard protocol={PROTO as any} />)
    expect(b.getByText('Verifique a internet. Os pesos continuam salvos.')).toBeTruthy()
    expect(b.queryByTestId(/weight-card-B/)).toBeNull()
    fireEvent.press(b.getByText('Tentar de novo'))
    expect(retry).toHaveBeenCalled()
    b.unmount()
    mockHook = { data: null, loading: false, error: 'other', retry, refreshAfterSave: jest.fn() }
    expect(render(<TreatmentWeightCard protocol={PROTO as any} />).getByText('Tente de novo. Os pesos continuam salvos.')).toBeTruthy()
  })

  it('PO-21: "Registrar peso" grava com entry_point measure_series e recarrega', async () => {
    const refreshAfterSave = jest.fn()
    mockHook = { ...ready(seriesOf([])), refreshAfterSave }
    mockCreate.mockResolvedValue({ id: 'b1', type: 'peso' })
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    fireEvent.press(utils.getByText('Registrar peso'))
    expect(mockSheetProps.open).toBe(true)
    expect(mockSheetProps.lockedType).toBe('peso')
    await act(async () => { await mockSheetProps.onSaved({ type: 'peso', value: 82.5 }) })
    expect(mockCreate).toHaveBeenCalledWith({ type: 'peso', value: 82.5 }, { entry_point: 'measure_series' })
    expect(refreshAfterSave).toHaveBeenCalled()
  })

  it('PO-21/FR-020: "Ver por etapa" recolhido; toque abre, emite toggled e lembra por user_id', async () => {
    mockHook = ready(B0())
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    expect(utils.queryAllByTestId('weight-step-row')).toHaveLength(0)
    await waitFor(() => {})
    fireEvent.press(utils.getByText('Ver por etapa'))
    expect(utils.getAllByTestId('weight-step-row')).toHaveLength(3)
    expect(utils.getByText('Etapa 3 · 7,5 mg · atual')).toBeTruthy()
    expect(utils.getByText('Doses tomadas: 1 de 1')).toBeTruthy()
    expect(mockLog).toHaveBeenCalledWith('measure_series_steps_toggled', { expanded: true, treatment_id: 'p1', surface: 'mobile' })
    expect(mockStorage[stepsStorageKey('u1')]).toBe('1')
  })

  it('FR-020: estado salvo reabre expandido para a mesma conta', async () => {
    mockStorage[stepsStorageKey('u1')] = '1'
    mockHook = ready(B0())
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    await waitFor(() => expect(utils.getAllByTestId('weight-step-row')).toHaveLength(3))
  })

  it('PO-12: label a11y do gráfico com o resumo completo mesmo recolhido', () => {
    mockHook = ready(B0())
    const utils = render(<TreatmentWeightCard protocol={PROTO as any} />)
    const label = utils.getByTestId('weight-step-chart').props.accessibilityLabel
    expect(label).toMatch(/^Gráfico de peso durante o tratamento\. 3 pesagens entre 2 ago e 1 out\./)
    expect(label).toMatch(/Etapa 3, 7,5 mg: peso médio 86,0 quilos em 1 pesagem/)
  })
})
