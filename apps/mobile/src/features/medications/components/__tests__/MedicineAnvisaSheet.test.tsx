// 066 Slice C (PO-1 · DESIGN_DECISOES C5) — busca 2C no MedicineAnvisaSheet: passo 1 de hoje, passo 2
// só concentração a partir do índice CMED, escolha única pula, sem índice/sem embalagem preenche como
// hoje. O índice só é pedido depois do 1º toque (C-C5). Eventos sem nome/texto (TRACKING_PLAN §5.3).

import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import { Modal } from 'react-native'
import { decodeCmedIndex } from '@dosiq/core'
import { MedicineAnvisaSheet } from '../MedicineAnvisaSheet'
import fixture from '../../../../../../../packages/core/src/services/cmed/__tests__/fixtures/cmed-fixture.json'

const mockSearch = jest.fn()
const mockLogEvent = jest.fn()
const mockCmedCalls: any[] = []
const mockCmed = { current: { status: 'ready', index: null as any, lookup: null } }

jest.mock('@shared/hooks/useMedicineDatabase', () => ({
  // O mínimo real vem do módulo: sem ele o mock apagaria a regra (066 E, C-8).
  MIN_SEARCH_CHARS: jest.requireActual('@shared/hooks/useMedicineDatabase').MIN_SEARCH_CHARS,
  useMedicineDatabase: () => ({ search: mockSearch, isReady: true }),
}))
jest.mock('@shared/hooks/useCmedIndex', () => ({
  useCmedIndex: (opts: any) => {
    mockCmedCalls.push(opts)
    return opts?.enabled ? mockCmed.current : { status: 'idle', index: null, lookup: null }
  },
}))
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))

function indexFrom(mutate?: (raw: any) => void) {
  const raw = JSON.parse(JSON.stringify(fixture))
  mutate?.(raw)
  const result = decodeCmedIndex(raw)
  if (result.ok === false) throw new Error('fixture não decodificou')
  return result.index
}

const DIVALPROATO = { name: 'Divalproato de Sódio', activeIngredient: 'Divalproato de Sódio', laboratory: 'Eurofarma', regulatoryCategory: 'Similar', forms: ['comprimido'] }
const CLOPIDOGREL = { name: 'Bissulfato de Clopidogrel', activeIngredient: 'Bissulfato de Clopidogrel', laboratory: null, regulatoryCategory: 'Genérico', forms: ['comprimido'] }
const ESPECIFICO = { name: 'Tisagenlecleucel', activeIngredient: 'Tisagenlecleucel', laboratory: null, regulatoryCategory: 'Específico' }
const SEM_CMED = { name: 'Remédio Fora da Lista', activeIngredient: 'Nada', laboratory: 'X', regulatoryCategory: 'Novo' }

// Divalproato com duas concentrações (250 mg X 30 / 500 mg X 60).
const TWO_STRENGTHS = () => indexFrom((raw) => {
  raw.cols.ds[10] = '250 mg'
  raw.cols.d[10] = 250
})

function renderSheet(items: any[]) {
  mockSearch.mockReturnValue(items)
  const onSelect = jest.fn()
  const onClose = jest.fn()
  const utils = render(<MedicineAnvisaSheet open onClose={onClose} onSelect={onSelect} />)
  fireEvent.changeText(utils.getByLabelText('Buscar medicamento'), 'abcd')
  return { ...utils, onSelect, onClose }
}

function eventProps(name: string) {
  return mockLogEvent.mock.calls.filter(([n]) => n === name).map(([, p]) => p)
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockCmedCalls.length = 0
  mockCmed.current = { status: 'ready', index: null, lookup: null }
})

describe('MedicineAnvisaSheet — busca 2C (066 Slice C)', () => {
  it('passo 1: "N resultados" e 3ª linha = laboratório ou categoria (C5.1 R-1/R-7)', () => {
    const { getByText, queryByText } = renderSheet([DIVALPROATO, CLOPIDOGREL, ESPECIFICO])
    expect(getByText('3 resultados')).toBeTruthy()
    expect(queryByText(/toque para preencher/)).toBeNull()
    expect(getByText('Eurofarma')).toBeTruthy()
    expect(getByText('Genérico')).toBeTruthy()
    expect(getByText('Específico')).toBeTruthy()
  })

  it('o índice não é pedido ao abrir nem ao digitar, só depois do toque num nome (C-C5)', () => {
    mockCmed.current = { status: 'ready', index: TWO_STRENGTHS(), lookup: null }
    const { getByLabelText } = renderSheet([DIVALPROATO])
    expect(mockCmedCalls.every((o) => o.enabled === false)).toBe(true)
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    expect(mockCmedCalls.some((o) => o.enabled === true)).toBe(true)
  })

  it('nome com 2+ concentrações abre o passo 2; a escolha devolve o rascunho dela', () => {
    mockCmed.current = { status: 'ready', index: TWO_STRENGTHS(), lookup: null }
    const { getByText, getByLabelText, onSelect } = renderSheet([DIVALPROATO])
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    expect(onSelect).not.toHaveBeenCalled()
    expect(getByText('Qual embalagem você tem?')).toBeTruthy()
    expect(getByText('250 mg')).toBeTruthy()
    fireEvent.press(getByText('500 mg'))
    const arg = onSelect.mock.calls[0][0]
    expect(arg.anvisaItem).toBe(DIVALPROATO)
    expect(arg.cmedDraft.dosage_per_pill).toBe(500)
    expect(arg.cmedDraft.anvisa_registration).toMatch(/^[0-9]{9}$/)
    expect(eventProps('medicine_presentation_selected')[0]).toMatchObject({ outcome: 'picked', presentation_count: 2, surface: 'mobile' })
  })

  it('quantidades diferentes na mesma concentração pulam o passo 2 (C5.1 R-4)', () => {
    mockCmed.current = { status: 'ready', index: indexFrom(), lookup: null }
    const { getByLabelText, queryByText, onSelect } = renderSheet([DIVALPROATO])
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    expect(queryByText('Qual embalagem você tem?')).toBeNull()
    expect(onSelect.mock.calls[0][0].cmedDraft.dosage_per_pill).toBe(500)
    expect(eventProps('medicine_presentation_selected')[0]).toMatchObject({ outcome: 'single' })
  })

  it('genérico: sem laboratório nem registro no rascunho (D11)', () => {
    mockCmed.current = { status: 'ready', index: indexFrom((raw) => { raw.cols.ds[14] = raw.cols.ds[11]; raw.cols.d[14] = raw.cols.d[11] }), lookup: null }
    const { getByLabelText, onSelect } = renderSheet([CLOPIDOGREL])
    fireEvent.press(getByLabelText(CLOPIDOGREL.name))
    const draft = onSelect.mock.calls[0][0].cmedDraft
    expect(draft.isGeneric).toBe(true)
    expect(draft.laboratory).toBeNull()
    expect(draft.anvisa_registration).toBeNull()
  })

  it('"‹" volta à busca com o texto preservado', () => {
    mockCmed.current = { status: 'ready', index: TWO_STRENGTHS(), lookup: null }
    const { getByLabelText, getByDisplayValue, queryByText, onSelect } = renderSheet([DIVALPROATO])
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    fireEvent.press(getByLabelText('Voltar'))
    expect(queryByText('Qual embalagem você tem?')).toBeNull()
    expect(getByDisplayValue('abcd')).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
    expect(eventProps('medicine_presentation_selected')[0]).toMatchObject({ outcome: 'back' })
  })

  it('voltar do Android no passo 2 volta à busca, sem fechar o sheet (C-C9)', () => {
    mockCmed.current = { status: 'ready', index: TWO_STRENGTHS(), lookup: null }
    const { getByLabelText, getByDisplayValue, queryByText, UNSAFE_getByType, onClose } = renderSheet([DIVALPROATO])
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    act(() => UNSAFE_getByType(Modal).props.onRequestClose())
    expect(queryByText('Qual embalagem você tem?')).toBeNull()
    expect(getByDisplayValue('abcd')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(eventProps('medicine_presentation_selected')[0]).toMatchObject({ outcome: 'back' })
    act(() => UNSAFE_getByType(Modal).props.onRequestClose())
    expect(onClose).toHaveBeenCalled()
  })

  it('toque duplo num resultado conta uma escolha só (C-C9)', () => {
    mockCmed.current = { status: 'ready', index: TWO_STRENGTHS(), lookup: null }
    const { getByLabelText } = renderSheet([DIVALPROATO])
    const row = getByLabelText(DIVALPROATO.name)
    fireEvent.press(row)
    fireEvent.press(row)
    expect(eventProps('medicine_search_result_selected')).toHaveLength(1)
  })

  it('"Minha embalagem não está aqui" preenche só com o item', () => {
    mockCmed.current = { status: 'ready', index: TWO_STRENGTHS(), lookup: null }
    const { getByText, getByLabelText, onSelect } = renderSheet([DIVALPROATO])
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    fireEvent.press(getByText('Minha embalagem não está aqui'))
    expect(onSelect).toHaveBeenCalledWith({ anvisaItem: DIVALPROATO })
  })

  it('nome sem embalagem na CMED cai no fallback defensivo (preenche como hoje)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockCmed.current = { status: 'ready', index: indexFrom(), lookup: null }
    const { getByLabelText, onSelect } = renderSheet([SEM_CMED])
    fireEvent.press(getByLabelText(SEM_CMED.name))
    expect(onSelect).toHaveBeenCalledWith({ anvisaItem: SEM_CMED })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it.each(['offline', 'failed', 'version'])('índice %s não bloqueia: preenche como hoje (INV-3)', (status) => {
    mockCmed.current = { status, index: null, lookup: null }
    const { getByLabelText, onSelect } = renderSheet([DIVALPROATO])
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    expect(onSelect).toHaveBeenCalledWith({ anvisaItem: DIVALPROATO })
    expect(eventProps('medicine_presentation_selected')[0]).toMatchObject({ outcome: 'unavailable' })
  })

  it('índice preparando: passo 2 mostra o aviso e a saída', () => {
    mockCmed.current = { status: 'preparing', index: null, lookup: null }
    const { getByText, getByLabelText, onSelect } = renderSheet([DIVALPROATO])
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    expect(getByText('Buscando na lista completa de embalagens da ANVISA...')).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.press(getByText('Minha embalagem não está aqui'))
    expect(onSelect).toHaveBeenCalledWith({ anvisaItem: DIVALPROATO })
  })

  it('eventos: abertura, seleção com posição e tamanho da busca — nunca o texto nem o nome (R-042)', () => {
    mockCmed.current = { status: 'ready', index: indexFrom(), lookup: null }
    const { getByLabelText } = renderSheet([CLOPIDOGREL, DIVALPROATO])
    fireEvent.press(getByLabelText(DIVALPROATO.name))
    expect(eventProps('medicine_search_opened')[0]).toEqual({ surface: 'mobile', entry_point: 'medicine_form' })
    expect(eventProps('medicine_search_result_selected')[0]).toEqual({ surface: 'mobile', result_rank: 2, query_length: 4, item_kind: 'brand' })
    const payload = JSON.stringify(mockLogEvent.mock.calls)
    expect(payload).not.toMatch(/abcd|Divalproato|Eurofarma|Clopidogrel/)
  })
})

describe('código de barras no sheet (066 D1 · C-D1-2: "Trocar" oferece os dois caminhos)', () => {
  it('com onScan, mostra "Ler o código de barras" antes de digitar e chama o scanner', () => {
    const onScan = jest.fn()
    const { getByLabelText, queryByLabelText } = render(
      <MedicineAnvisaSheet open onClose={jest.fn()} onSelect={jest.fn()} onScan={onScan} />,
    )
    fireEvent.press(getByLabelText('Ler o código de barras'))
    expect(onScan).toHaveBeenCalledTimes(1)
    fireEvent.changeText(getByLabelText('Buscar medicamento'), 'losartana')
    expect(queryByLabelText('Ler o código de barras')).toBeNull()
  })

  it('sem onScan, o sheet fica como antes', () => {
    const { queryByLabelText } = render(<MedicineAnvisaSheet open onClose={jest.fn()} onSelect={jest.fn()} />)
    expect(queryByLabelText('Ler o código de barras')).toBeNull()
  })
})

describe('mínimo de letras da busca (066 E, C-8)', () => {
  it('2 letras: mostra o aviso de 3 letras e nem chama a busca — nunca "Nenhum resultado"', () => {
    mockSearch.mockReturnValue([])
    const { getByLabelText, getByText, queryByText } = render(
      <MedicineAnvisaSheet open onClose={jest.fn()} onSelect={jest.fn()} />,
    )
    mockSearch.mockClear()
    fireEvent.changeText(getByLabelText('Buscar medicamento'), 'ni')
    expect(getByText('Digite ao menos 3 letras')).toBeTruthy()
    expect(queryByText('Nenhum resultado')).toBeNull()
    expect(mockSearch).not.toHaveBeenCalled()
  })
})
