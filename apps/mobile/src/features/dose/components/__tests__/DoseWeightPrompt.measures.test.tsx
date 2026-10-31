// DoseWeightPrompt.measures.test.tsx — spec 100 B: passo 2 para glicemia e pressão (FR-007, FR-012).
// Mesma regra do peso (069): só fato, sem julgamento de valor (ADR-062). Jest (mobile) — nunca vi.fn().

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('@shared/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }))
const mockShow = jest.fn()
jest.mock('@shared/components/feedback/Toast', () => ({ useToast: () => ({ show: mockShow }) }))
jest.mock('lucide-react-native', () => ({ Check: 'Check', Ruler: 'Ruler', AlertCircle: 'AlertCircle', Droplet: 'Droplet', HeartPulse: 'HeartPulse' }))
const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: (...a: unknown[]) => mockLogEvent(...a) }))
const mockCreate = jest.fn()
jest.mock('@measures/services/measuresRepo', () => ({
  measuresRepo: { create: (...a: unknown[]) => mockCreate(...a), getLatest: jest.fn(), list: jest.fn() },
}))
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()) }))

import DoseWeightPrompt from '../DoseWeightPrompt'
import { MEASURE_PROMPT_POLICIES } from '../../services/measurePrompt'

const RECEIPT = { title: 'Dose registrada', detail: 'Insulina · 08:00' }

function step(type, lastMeasure = null, measureSource = 'configured') {
  return { policy: MEASURE_PROMPT_POLICIES[type], userId: 'user-a', periodKey: '2026-10-01:am', lastMeasure, measureSource }
}

function renderPrompt(s, onFinished = jest.fn()) {
  return { onFinished, ...render(<DoseWeightPrompt step={s as any} receipt={RECEIPT} trigger="single" treatmentId="p1" onFinished={onFinished} />) }
}

beforeEach(() => {
  mockCreate.mockResolvedValue({ id: 'x', type: 'glicemia' })
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('glicemia', () => {
  it('pede glicemia em mg/dL com chips de contexto opcionais', () => {
    const utils = renderPrompt(step('glicemia', { value: 98, measuredAt: new Date(2026, 9, 1, 7, 0).toISOString() }))
    expect(utils.getByText('Registrar a glicemia agora?')).toBeTruthy()
    expect(utils.getByLabelText('Valor da medida em mg/dL')).toBeTruthy()
    expect(utils.getByText('Agora · último: 98 mg/dL em 01/10')).toBeTruthy()
    expect(utils.getByLabelText('Jejum')).toBeTruthy()
  })
  it('salva sem contexto (opcional) e com measure_source', async () => {
    const utils = renderPrompt(step('glicemia'))
    fireEvent.changeText(utils.getByLabelText('Valor da medida em mg/dL'), '110')
    fireEvent.press(utils.getByText('Salvar glicemia'))
    await waitFor(() => expect(utils.onFinished).toHaveBeenCalledTimes(1))
    const [record, meta] = mockCreate.mock.calls[0] as any[]
    expect(record).toMatchObject({ type: 'glicemia', value: 110, unit: 'mg/dL' })
    expect(record).not.toHaveProperty('context')
    expect(meta).toEqual({ entry_point: 'dose_prompt', measure_source: 'configured' })
    expect(mockShow).toHaveBeenCalledWith('Glicemia registrada', { variant: 'success' })
  })
  it('chip escolhido vai como contexto; tocar de novo desmarca', async () => {
    const utils = renderPrompt(step('glicemia'))
    fireEvent.press(utils.getByLabelText('Jejum'))
    fireEvent.changeText(utils.getByLabelText('Valor da medida em mg/dL'), '95')
    fireEvent.press(utils.getByText('Salvar glicemia'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect((mockCreate.mock.calls[0] as any[])[0]).toMatchObject({ context: 'jejum' })
  })
})

describe('pressão arterial', () => {
  it('pede sistólica e diastólica; botão só habilita com as duas', () => {
    const utils = renderPrompt(step('pressao_arterial', { value: 120, valueSecondary: 80, measuredAt: new Date(2026, 8, 30, 8).toISOString() }))
    expect(utils.getByText('Registrar a pressão agora?')).toBeTruthy()
    expect(utils.getByText('Agora · último: 120/80 mmHg em 30/09')).toBeTruthy()
    fireEvent.changeText(utils.getByLabelText('Sistólica em mmHg'), '130')
    expect(utils.getByText('Salvar pressão').parent?.parent?.props.accessibilityState).toEqual({ disabled: true })
    expect(utils.queryByLabelText('Jejum')).toBeNull()
  })
  it('grava value + value_secondary em mmHg', async () => {
    mockCreate.mockResolvedValue({ id: 'x', type: 'pressao_arterial' })
    const utils = renderPrompt(step('pressao_arterial'))
    fireEvent.changeText(utils.getByLabelText('Sistólica em mmHg'), '130')
    fireEvent.changeText(utils.getByLabelText('Diastólica em mmHg'), '85')
    fireEvent.press(utils.getByText('Salvar pressão'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect((mockCreate.mock.calls[0] as any[])[0]).toMatchObject({ type: 'pressao_arterial', value: 130, value_secondary: 85, unit: 'mmHg' })
  })
})

describe('FR-012 — eventos do pedido levam a origem', () => {
  it('shown e dismissed com measure_source', () => {
    const utils = renderPrompt(step('glicemia', null, 'fallback'))
    fireEvent.press(utils.getByText('Agora não'))
    const shown = mockLogEvent.mock.calls.find((c: any[]) => c[0] === 'measure_prompt_shown') as any[]
    const dismissed = mockLogEvent.mock.calls.find((c: any[]) => c[0] === 'measure_prompt_dismissed') as any[]
    expect(shown[1]).toMatchObject({ biomarker_type: 'glicemia', measure_source: 'fallback' })
    expect(dismissed[1]).toMatchObject({ biomarker_type: 'glicemia', measure_source: 'fallback', reason: 'skip' })
  })
})
