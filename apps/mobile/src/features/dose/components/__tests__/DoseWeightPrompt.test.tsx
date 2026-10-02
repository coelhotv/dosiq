// DoseWeightPrompt.test.tsx — spec 069 A2: passo 2 do sheet de dose (pedido de peso).
// PO-1 (adia onSuccess) · PO-2 (o que marca a semana) · PO-4 (erro não toca a dose) · PO-5b (lote 1×)
// · PO-14 (faixa na UI) · PO-19 (eventos). Jest (mobile) — nunca vi.fn().

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import React from 'react'
import { Modal } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'

jest.mock('../../services/doseService', () => ({
  registerDose: jest.fn(),
  registerDoseMany: jest.fn(),
  getLastInjectionSite: jest.fn(() => Promise.resolve(null)),
}))
// Seletor de local (071) fora do escopo: injetável renderiza o picker, que tem a própria suíte
jest.mock('@shared/components/form/InjectionSitePicker', () => () => null)
jest.mock('../../hooks/usePlanProtocols', () => ({ usePlanProtocols: jest.fn() }))
let mockOnline = true
jest.mock('@shared/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: mockOnline }) }))
const mockShow = jest.fn()
jest.mock('@shared/components/feedback/Toast', () => ({ useToast: () => ({ show: mockShow }) }))
jest.mock('lucide-react-native', () => ({
  AlertTriangle: 'AlertTriangle', Check: 'Check', Ruler: 'Ruler', AlertCircle: 'AlertCircle',
  CheckCircle: 'CheckCircle', Circle: 'Circle', Calendar: 'Calendar', Clock: 'Clock', Folder: 'Folder',
  ChevronRight: 'ChevronRight', ChevronUp: 'ChevronUp',
}))
const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: (...a: unknown[]) => mockLogEvent(...a) }))
const mockCreate = jest.fn()
jest.mock('@measures/services/measuresRepo', () => ({
  measuresRepo: { create: (...a: unknown[]) => mockCreate(...a), getLatest: jest.fn() },
}))
const mockResolve = jest.fn()
const mockMark = jest.fn()
jest.mock('../../services/measurePrompt', () => ({
  ...jest.requireActual('../../services/measurePrompt'),
  resolvePostDoseStep: (...a: unknown[]) => mockResolve(...a),
  markPromptPeriod: (...a: unknown[]) => mockMark(...a),
}))

const { registerDose, registerDoseMany } = require('../../services/doseService')
const { usePlanProtocols } = require('../../hooks/usePlanProtocols')
const { isWeightEligible, MEASURE_PROMPT_POLICIES } = jest.requireActual('../../services/measurePrompt') as any

import DoseRegisterModal from '../DoseRegisterModal'
import BulkDoseRegisterModal from '../BulkDoseRegisterModal'

const STEP = {
  policy: MEASURE_PROMPT_POLICIES.peso,
  userId: 'user-a',
  periodKey: '2026-09-28',
  lastMeasure: { value: 86, measuredAt: new Date(2026, 8, 24, 9, 0).toISOString() },
}

const MOUNJARO = {
  id: 'p-mj',
  medicine_id: 'm-mj',
  dosage_per_intake: 1,
  intake_unit: null,
  frequency: 'semanal',
  medicine: { id: 'm-mj', name: 'Mounjaro', presentation: 'injetavel' },
}

const WEIGHT_INPUT = 'Valor da medida em kg'

function renderSingle(props = {}) {
  const onSuccess = jest.fn()
  const onClose = jest.fn()
  const utils = render(
    <DoseRegisterModal visible protocol={MOUNJARO} medicineName="Mounjaro" scheduledTime="14:30"
      instanceId="inst-1" onClose={onClose} onSuccess={onSuccess} {...props} />
  )
  return { ...utils, onSuccess, onClose }
}

async function openStep2(utils) {
  fireEvent.press(utils.getByText('Confirmar'))
  return utils.findByText('Registrar o peso de hoje?')
}

const eventsNamed = (name: string) => mockLogEvent.mock.calls.filter((c) => c[0] === name)

beforeEach(() => {
  mockOnline = true
  jest.mocked(registerDose).mockResolvedValue({ success: true, data: {} } as any)
  mockResolve.mockResolvedValue(STEP)
  mockMark.mockResolvedValue(undefined)
  mockCreate.mockResolvedValue({ id: 'b1', type: 'peso' })
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('PO-1 — passo 2 no single', () => {
  it('exibe o passo 2 quando elegível e só chama onSuccess ao fechar', async () => {
    const utils = renderSingle()
    await openStep2(utils)
    expect(utils.getByText('Dose registrada')).toBeTruthy()
    expect(utils.getByText(/^Mounjaro · \d\d:\d\d$/)).toBeTruthy() // sem local escolhido
    expect(utils.onSuccess).not.toHaveBeenCalled()
    fireEvent.press(utils.getByText('Agora não'))
    expect(utils.onSuccess).toHaveBeenCalledTimes(1)
    expect(utils.onClose).not.toHaveBeenCalled()
    expect(mockResolve).toHaveBeenCalledWith({ items: [{ protocol: MOUNJARO }] })
  })

  it('não elegível (slot devolve null) fecha como hoje: onSuccess direto, sem passo 2 e sem toast', async () => {
    mockResolve.mockResolvedValue(null)
    const utils = renderSingle()
    fireEvent.press(utils.getByText('Confirmar'))
    await waitFor(() => expect(utils.onSuccess).toHaveBeenCalledTimes(1))
    expect(utils.queryByText('Registrar o peso de hoje?')).toBeNull()
    expect(mockShow).not.toHaveBeenCalled()
  })

  it('teclado fechado ao entrar; rodapé mostra o último peso como fato', async () => {
    const utils = renderSingle()
    await openStep2(utils)
    expect(utils.getByLabelText(WEIGHT_INPUT).props.autoFocus).toBe(false)
    expect(utils.getByText('Agora · último: 86,0 kg em 24/09')).toBeTruthy()
  })

  it("campo vazio desabilita Salvar peso (nunca grava 0)", async () => {
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.press(utils.getByText('Salvar peso'))
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('PO-2 — o que encerra a semana', () => {
  it('salvar grava 82,5 kg pelo measuresRepo, toast e fecha SEM marcar a semana (R-15: a recência suprime; apagar o peso reabre)', async () => {
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '82,5')
    fireEvent.press(utils.getByText('Salvar peso'))
    await waitFor(() => expect(utils.onSuccess).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith(
      { id: expect.any(String), type: 'peso', value: 82.5, unit: 'kg' }, { entry_point: 'dose_prompt' })
    expect(mockMark).not.toHaveBeenCalled()
    expect(mockShow).toHaveBeenCalledWith('Peso registrado', { variant: 'success' })
  })

  it('não reexibe após dispensar ("Agora não" marca, nada gravado)', async () => {
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.press(utils.getByText('Agora não'))
    expect(mockMark).toHaveBeenCalledWith(STEP)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockShow).not.toHaveBeenCalled()
  })

  it('não reexibe após arrastar (fechar sem botão marca como dispensar)', async () => {
    const utils = renderSingle()
    await openStep2(utils)
    act(() => utils.UNSAFE_getByType(Modal).props.onRequestClose())
    expect(mockMark).toHaveBeenCalledWith(STEP)
    expect(utils.onSuccess).toHaveBeenCalledTimes(1)
    expect(utils.onClose).not.toHaveBeenCalled()
  })

  it('reexibe após fechar sem peso (erro + "Fechar sem peso" NÃO marca)', async () => {
    mockCreate.mockRejectedValue({ message: 'TypeError: Network request failed', code: '' })
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '84,2')
    fireEvent.press(utils.getByText('Salvar peso'))
    await utils.findByText('O peso não foi salvo')
    fireEvent.press(utils.getByText('Fechar sem peso'))
    expect(mockMark).not.toHaveBeenCalled()
    expect(utils.onSuccess).toHaveBeenCalledTimes(1)
  })
})

describe('PO-4 — falha no peso não toca a dose', () => {
  it('erro no peso preserva a dose (registerDose 1×, recibo visível, valor mantido)', async () => {
    mockCreate.mockRejectedValue({ message: 'TypeError: Network request failed', code: '' })
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '84,2')
    fireEvent.press(utils.getByText('Salvar peso'))
    await utils.findByText('O peso não foi salvo')
    expect(registerDose).toHaveBeenCalledTimes(1)
    expect(utils.getByText('Dose registrada')).toBeTruthy()
    expect(utils.getByLabelText(WEIGHT_INPUT).props.value).toBe('84,2')
    expect(utils.onSuccess).not.toHaveBeenCalled()
  })

  it('erro de rede mostra Sem internet', async () => {
    mockCreate.mockRejectedValue({ message: 'TypeError: Network request failed', code: '' })
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '84')
    fireEvent.press(utils.getByText('Salvar peso'))
    expect(await utils.findByText('Sem internet. A dose está salva.')).toBeTruthy()
  })

  it('erro 5xx mostra Tente de novo; "Tentar de novo" grava na 2ª', async () => {
    mockCreate.mockRejectedValueOnce({ message: 'upstream error', code: '503' })
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '84')
    fireEvent.press(utils.getByText('Salvar peso'))
    expect(await utils.findByText('Tente de novo. A dose está salva.')).toBeTruthy()
    fireEvent.press(utils.getByText('Tentar de novo'))
    await waitFor(() => expect(utils.onSuccess).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(registerDose).toHaveBeenCalledTimes(1)
  })
})

describe('PO-14 — faixa 20–200 kg no passo 2', () => {
  it.each(['19,9', '200,1'])('%s mostra a regra e não grava', async (typed) => {
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), typed)
    fireEvent.press(utils.getByText('Salvar peso'))
    expect(await utils.findByText('Use um valor entre 20 e 200 kg.')).toBeTruthy()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(utils.onSuccess).not.toHaveBeenCalled()
  })
})

describe('PO-19 — eventos do passo 2', () => {
  it('shown 1× por sheet com treatment_id e entry_point herdado; sem valor clínico', async () => {
    const utils = renderSingle({ entryPoint: 'reminder' })
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '82,5')
    expect(eventsNamed('measure_prompt_shown')).toEqual([[
      'measure_prompt_shown',
      { biomarker_type: 'peso', trigger: 'single', surface: 'mobile', treatment_id: 'p-mj', entry_point: 'reminder' },
    ]])
  })

  it.each([
    ['skip', (u) => fireEvent.press(u.getByText('Agora não'))],
    ['swipe', (u) => act(() => u.UNSAFE_getByType(Modal).props.onRequestClose())],
  ])('dismissed com reason %s', async (reason, close) => {
    const utils = renderSingle()
    await openStep2(utils)
    close(utils)
    expect(eventsNamed('measure_prompt_dismissed')).toEqual([[
      'measure_prompt_dismissed', { biomarker_type: 'peso', trigger: 'single', surface: 'mobile', reason },
    ]])
  })

  it('dismissed com reason close_after_error (botão ou fechar sem botão no erro)', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '84')
    fireEvent.press(utils.getByText('Salvar peso'))
    await utils.findByText('O peso não foi salvo')
    act(() => utils.UNSAFE_getByType(Modal).props.onRequestClose())
    expect(eventsNamed('measure_prompt_dismissed')[0][1]).toMatchObject({ reason: 'close_after_error' })
    expect(mockMark).not.toHaveBeenCalled()
  })

  it('salvar não emite dismissed', async () => {
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '82,5')
    fireEvent.press(utils.getByText('Salvar peso'))
    await waitFor(() => expect(utils.onSuccess).toHaveBeenCalled())
    expect(eventsNamed('measure_prompt_dismissed')).toEqual([])
  })
})

// ── Lote (AC-7b) ───────────────────────────────────────────────────────────────
const SELOZOK = { id: 'p-sz', name: 'Selozok', frequency: 'diário', dosage_per_intake: 1, medicine: { id: 'm-sz', name: 'Selozok', presentation: 'comprimido' } }
const OZEMPIC = { id: 'p-oz', name: 'Ozempic', frequency: 'semanal', dosage_per_intake: 1, medicine: { id: 'm-oz', name: 'Ozempic', presentation: 'injetavel' } }
const MJ_BULK = { ...MOUNJARO, name: 'Mounjaro' }

function renderBulk(protocols) {
  jest.mocked(usePlanProtocols).mockReturnValue({ protocols: [], loading: false, error: null })
  jest.mocked(registerDoseMany).mockResolvedValue({
    success: true, results: protocols.map((p, i) => ({ id: `log-${i}`, success: true })),
  } as any)
  // Elegibilidade real (o mock só corta o I/O)
  mockResolve.mockImplementation(async ({ items }) => (items.some(isWeightEligible) ? STEP : null))
  const onSuccess = jest.fn()
  const utils = render(
    <BulkDoseRegisterModal visible mode="active" initialProtocols={protocols} onClose={jest.fn()} onSuccess={onSuccess} userId="user-a" />
  )
  return { ...utils, onSuccess }
}

describe('PO-5b — lote', () => {
  it('lote com injetável exibe o passo 2 1× com recibo do lote', async () => {
    const utils = renderBulk([MJ_BULK, SELOZOK])
    expect(utils.queryByText(/peso/i)).toBeNull() // passo 1 não anuncia o peso
    fireEvent.press(utils.getByText('Registrar 2 doses'))
    expect(await utils.findByText('2 doses registradas')).toBeTruthy()
    expect(utils.getByText(/^Mounjaro e Selozok · \d\d:\d\d$/)).toBeTruthy()
    expect(eventsNamed('measure_prompt_shown')).toEqual([[
      'measure_prompt_shown', { biomarker_type: 'peso', trigger: 'bulk', surface: 'mobile' },
    ]])
    expect(mockShow).not.toHaveBeenCalled() // recibo substitui o toast do lote
    expect(utils.onSuccess).not.toHaveBeenCalled()
    fireEvent.press(utils.getByText('Agora não'))
    expect(utils.onSuccess).toHaveBeenCalledWith({ successCount: 2 })
  })

  it('lote com 2 injetáveis exibe 1×', async () => {
    const utils = renderBulk([MJ_BULK, OZEMPIC])
    fireEvent.press(utils.getByText('Registrar 2 doses'))
    await utils.findByText('Registrar o peso de hoje?')
    expect(mockResolve).toHaveBeenCalledTimes(1)
    expect(eventsNamed('measure_prompt_shown')).toHaveLength(1)
  })

  it('lote só de dose diária fecha como hoje', async () => {
    const utils = renderBulk([SELOZOK])
    fireEvent.press(utils.getByText('Registrar 1 dose'))
    await waitFor(() => expect(utils.onSuccess).toHaveBeenCalledWith({ successCount: 1 }))
    expect(utils.queryByText('Registrar o peso de hoje?')).toBeNull()
    expect(mockShow).toHaveBeenCalledWith('Dose registrada com sucesso.', expect.anything())
  })

  it('sucesso parcial não abre o passo 2 (o erro do lote fica visível — G-2)', async () => {
    const utils = renderBulk([MJ_BULK, SELOZOK])
    jest.mocked(registerDoseMany).mockResolvedValue({
      success: false, results: [{ id: 'l1', success: true }, { id: 'l2', success: false, error: 'x' }],
    } as any)
    fireEvent.press(utils.getByText('Registrar 2 doses'))
    await waitFor(() => expect(utils.onSuccess).toHaveBeenCalledWith({ successCount: 1 }))
    expect(utils.queryByText('Registrar o peso de hoje?')).toBeNull()
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('3+ nomes no recibo: "{A}, {B} e mais {n}"', () => {
    const { buildBatchReceipt } = require('../../utils/bulkDoseHelpers')
    const at = new Date(2026, 9, 1, 14, 30)
    const items = [MJ_BULK, SELOZOK, OZEMPIC].map((p) => ({ protocol: p }))
    expect(buildBatchReceipt(items, at)).toEqual({ title: '3 doses registradas', detail: 'Mounjaro, Selozok e mais 1 · 14:30' })
  })
})

// ── Sem rede: camada 1 (offline conhecido), camada 2 (teto 15 s — R-168), idempotência ─────────
describe('PO-4 — sem rede e retry sem duplicar (PO 02/10)', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('camada 1: offline conhecido → "Sem internet" na hora, sem tentar gravar', async () => {
    const utils = renderSingle()
    await openStep2(utils)
    mockOnline = false
    utils.rerender(
      <DoseRegisterModal visible protocol={MOUNJARO} medicineName="Mounjaro" scheduledTime="14:30"
        instanceId="inst-1" onClose={utils.onClose} onSuccess={utils.onSuccess} />
    )
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '84')
    fireEvent.press(utils.getByText('Salvar peso'))
    expect(await utils.findByText('Sem internet. A dose está salva.')).toBeTruthy()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('camada 2: sem resposta em 15 s → "Sem internet" e libera as ações', async () => {
    const utils = renderSingle()
    await openStep2(utils)
    jest.useFakeTimers()
    try {
      mockCreate.mockReturnValue(new Promise(() => {}))
      fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '84')
      fireEvent.press(utils.getByText('Salvar peso'))
      expect(utils.getByText('Salvando…')).toBeTruthy()
      await act(async () => { await jest.advanceTimersByTimeAsync(15_000) })
      expect(utils.getByText('Sem internet. A dose está salva.')).toBeTruthy()
      expect(utils.getByText('Tentar de novo')).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })

  it('"Tentar de novo" reenvia com o MESMO id (UUID v4) — o 23505 do core vira sucesso, sem duplicar', async () => {
    mockCreate.mockRejectedValueOnce({ message: 'TypeError: Network request failed', code: '' })
    const utils = renderSingle()
    await openStep2(utils)
    fireEvent.changeText(utils.getByLabelText(WEIGHT_INPUT), '84')
    fireEvent.press(utils.getByText('Salvar peso'))
    await utils.findByText('O peso não foi salvo')
    fireEvent.press(utils.getByText('Tentar de novo'))
    await waitFor(() => expect(utils.onSuccess).toHaveBeenCalledTimes(1))
    const [first, second] = mockCreate.mock.calls.map((c) => (c[0] as any).id)
    expect(first).toMatch(UUID_RE)
    expect(second).toBe(first)
  })

  it('novo passo 2 (outra dose) usa outro id', async () => {
    const a = renderSingle()
    await openStep2(a)
    fireEvent.changeText(a.getByLabelText(WEIGHT_INPUT), '84')
    fireEvent.press(a.getByText('Salvar peso'))
    await waitFor(() => expect(a.onSuccess).toHaveBeenCalled())
    a.unmount()
    const b = renderSingle()
    await openStep2(b)
    fireEvent.changeText(b.getByLabelText(WEIGHT_INPUT), '85')
    fireEvent.press(b.getByText('Salvar peso'))
    await waitFor(() => expect(b.onSuccess).toHaveBeenCalled())
    const ids = mockCreate.mock.calls.map((c) => (c[0] as any).id)
    expect(ids[0]).not.toBe(ids[1])
  })
})
