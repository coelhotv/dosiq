// 066 D1 (PO-2 · PO-3 · PO-7 · PO-9 · PO-11 · RC3 E-2/E-3/E-4) — tela do scanner: devolve o rascunho
// ao form (nunca grava), trava na 1ª leitura, desliga a câmera fora de foco, cada falha diz o motivo e
// mantém "Digitar manualmente", eventos sem EAN/nome/substância/laboratório.

import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import { decodeCmedIndex, buildEanLookup } from '@dosiq/core'
import fixture from '../../../../../../../packages/core/src/services/cmed/__tests__/fixtures/cmed-fixture.json'
import BarcodeScannerScreen from '../BarcodeScannerScreen'

const { __cameraMock: camera } = jest.requireMock('expo-camera')
const mockNav = { popTo: jest.fn(), goBack: jest.fn(), navigate: jest.fn() }
const mockFocus = { current: true }
const mockRoute = { current: { params: { entryPoint: 'medicine_form' } } }
const mockLogEvent = jest.fn()
const mockCmed = { current: { status: 'ready', index: null as any, lookup: null as any } }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => mockRoute.current,
  useIsFocused: () => mockFocus.current,
}))
jest.mock('@shared/hooks/useCmedIndex', () => ({
  useCmedIndex: () => mockCmed.current,
}))
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}))

function loadIndex(mutate?: (raw: any) => void) {
  const raw = JSON.parse(JSON.stringify(fixture))
  mutate?.(raw)
  const result = decodeCmedIndex(raw)
  if (result.ok === false) throw new Error('fixture não decodificou')
  mockCmed.current = { status: 'ready', index: result.index, lookup: buildEanLookup(result.index) }
}

function scan(data: string) {
  act(() => {
    camera.lastProps.onBarcodeScanned({ data, type: 'ean13' })
  })
}

const IDENTIFYING = /\d{13}|Amoxicilina|Clavulanato|EMS|Divalproato/i

beforeEach(() => {
  camera.permission = { granted: true, canAskAgain: true, status: 'granted' }
  camera.requestResult = null
  camera.lastProps = null
  mockFocus.current = true
  loadIndex()
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('leitura', () => {
  it('EAN conhecido volta ao form com o rascunho, sem gravar nada (PO-2, E-2)', () => {
    render(<BarcodeScannerScreen />)
    expect(camera.lastProps.barcodeScannerSettings).toEqual({ barcodeTypes: ['ean13'] })
    scan('7896004778402')
    expect(mockNav.popTo).toHaveBeenCalledTimes(1)
    const [route, params, options] = mockNav.popTo.mock.calls[0]
    expect(route).toBe('MedicineCreate')
    expect(options).toEqual({ merge: true })
    expect(params.scanDraft).toMatchObject({ dosage_per_pill: 500, dosage_unit: 'mg', presentation: 'comprimido', boxQuantity: 21 })
    expect(params).not.toHaveProperty('rowIdx')
    expect(params.scanDraft).not.toHaveProperty('rowIdx')
  })

  it('o mesmo código lido em vários quadros conta uma vez só (E-4)', () => {
    render(<BarcodeScannerScreen />)
    const onScan = camera.lastProps.onBarcodeScanned
    act(() => {
      onScan({ data: '7896004778402' })
      onScan({ data: '7896004778402' })
      onScan({ data: '7896004778402' })
    })
    expect(mockNav.popTo).toHaveBeenCalledTimes(1)
  })

  it('EAN fora da lista diz o motivo, oferece ler outra e digitar (PO-3)', () => {
    const { getByText } = render(<BarcodeScannerScreen />)
    scan('7891234567895')
    expect(getByText('Esta caixa não está na lista')).toBeTruthy()
    expect(getByText('Cadastrar digitando')).toBeTruthy()
    expect(mockNav.popTo).not.toHaveBeenCalled()
    fireEvent.press(getByText('Ler outra caixa'))
    expect(camera.lastProps).toBeTruthy()
    scan('7896004778402')
    expect(mockNav.popTo).toHaveBeenCalledTimes(1)
  })

  it('EAN com concentrações diferentes pergunta antes de preencher (PO-9)', () => {
    loadIndex((raw) => {
      raw.cols.d[10] = 250
      raw.cols.ds[10] = '250 mg'
    })
    const { getByText } = render(<BarcodeScannerScreen />)
    scan('7891317020576')
    expect(mockNav.popTo).not.toHaveBeenCalled()
    expect(getByText('Qual embalagem você tem?')).toBeTruthy()
    fireEvent.press(getByText('250 mg'))
    const params = mockNav.popTo.mock.calls[0][1]
    expect(params.scanDraft.dosage_per_pill).toBe(250)
    expect(params.scanDraft.boxQuantity).toBeNull()
  })

  it('20 s sem leitura → ilegível com lanterna/digitação (PO-3)', () => {
    jest.useFakeTimers()
    const { getByText } = render(<BarcodeScannerScreen />)
    act(() => {
      jest.advanceTimersByTime(20_000)
    })
    expect(getByText('Não deu para ler o código')).toBeTruthy()
    expect(getByText('Digitar manualmente')).toBeTruthy()
  })
})

describe('câmera só com foco (E-3)', () => {
  it('fora de foco não monta a câmera', () => {
    mockFocus.current = false
    const { queryByTestId } = render(<BarcodeScannerScreen />)
    expect(queryByTestId('camera-view')).toBeNull()
  })
})

describe('falhas sempre com motivo e manual (PO-3 · PO-7)', () => {
  // Saída para o cadastro digitado: link "Digitar manualmente" ou botão "Cadastrar digitando" (artboards x-*).
  it.each([
    ['nunca perguntada', { granted: false, canAskAgain: true, status: 'undetermined' }, 'ready', 'A câmera lê o código de barras da caixa', 'Digitar manualmente'],
    ['negada', { granted: false, canAskAgain: true, status: 'denied' }, 'ready', 'Sem acesso à câmera', 'Cadastrar digitando'],
    ['bloqueada', { granted: false, canAskAgain: false, status: 'denied' }, 'ready', 'A câmera está bloqueada para o Dosiq', 'Cadastrar digitando'],
    ['offline', { granted: true, canAskAgain: true, status: 'granted' }, 'offline', 'Sem internet para preparar a leitura', 'Cadastrar digitando'],
    ['índice falhou', { granted: true, canAskAgain: true, status: 'granted' }, 'failed', 'Não deu para preparar a leitura', 'Digitar manualmente'],
    ['versão', { granted: true, canAskAgain: true, status: 'granted' }, 'version', 'Atualize o app para usar a leitura', 'Cadastrar digitando'],
  ])('%s', (_label, permission, status, title, manual) => {
    camera.permission = permission
    mockCmed.current = { ...mockCmed.current, status }
    const { getByText, queryByTestId } = render(<BarcodeScannerScreen />)
    expect(getByText(title)).toBeTruthy()
    expect(queryByTestId('camera-view')).toBeNull()
    fireEvent.press(getByText(manual))
    // C-D1-3: a saída manual volta ao form pedindo a rolagem até "Identificação".
    expect(mockNav.popTo).toHaveBeenCalledWith('MedicineCreate', { manualEntry: expect.any(Number) }, { merge: true })
    expect(mockNav.goBack).not.toHaveBeenCalled()
  })

  it('o ✕ só fecha, sem pedir rolagem', () => {
    camera.permission = { granted: false, canAskAgain: true, status: 'denied' }
    const { getByLabelText } = render(<BarcodeScannerScreen />)
    fireEvent.press(getByLabelText('Fechar'))
    expect(mockNav.goBack).toHaveBeenCalled()
    expect(mockNav.popTo).not.toHaveBeenCalled()
  })

  it('bloqueada abre os Ajustes; versão abre a loja (E10)', async () => {
    const { Linking } = require('react-native')
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
    const url = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    camera.permission = { granted: false, canAskAgain: false, status: 'denied' }
    const blocked = render(<BarcodeScannerScreen />)
    await act(async () => {
      fireEvent.press(blocked.getByText('Abrir Ajustes do celular'))
    })
    expect(settings).toHaveBeenCalled()
    blocked.unmount()
    camera.permission = { granted: true, canAskAgain: true, status: 'granted' }
    mockCmed.current = { ...mockCmed.current, status: 'version' }
    const version = render(<BarcodeScannerScreen />)
    await act(async () => {
      fireEvent.press(version.getByText('Abrir a loja'))
    })
    expect(url).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/(apps\.apple|play\.google)\.com/))
    settings.mockRestore()
    url.mockRestore()
  })

  it('offline: "Tentar de novo" volta a preparar a leitura', async () => {
    mockCmed.current = { ...mockCmed.current, status: 'offline' }
    const { getByText, getByLabelText } = render(<BarcodeScannerScreen />)
    mockCmed.current = { ...mockCmed.current, status: 'preparing' }
    await act(async () => {
      fireEvent.press(getByText('Tentar de novo'))
    })
    expect(getByLabelText('Preparando a leitura')).toBeTruthy()
  })

  it('permitir câmera registra o resultado sem dado identificável', async () => {
    camera.permission = { granted: false, canAskAgain: true, status: 'undetermined' }
    camera.requestResult = { granted: true, canAskAgain: true, status: 'granted' }
    const { getByText } = render(<BarcodeScannerScreen />)
    await act(async () => {
      fireEvent.press(getByText('Permitir câmera'))
    })
    expect(mockLogEvent).toHaveBeenCalledWith('scan_permission', expect.objectContaining({ result: 'granted' }))
  })
})

describe('analytics sem dado identificável (PO-11 · FR-025)', () => {
  it('scan_opened e scan_result não levam EAN, nome, substância nem laboratório', () => {
    render(<BarcodeScannerScreen />)
    scan('7896004778402')
    const names = mockLogEvent.mock.calls.map(([name]) => name)
    expect(names).toEqual(expect.arrayContaining(['scan_opened', 'scan_result']))
    for (const [, props] of mockLogEvent.mock.calls) {
      expect(JSON.stringify(props)).not.toMatch(IDENTIFYING)
    }
    expect(mockLogEvent).toHaveBeenCalledWith('scan_result', expect.objectContaining({ result: 'found' }))
  })
})

describe('Android "Perguntar sempre" (C-D1-5: não afirma bloqueio sem pedir)', () => {
  const { Platform } = require('react-native')
  const originalOS = Platform.OS
  const LOOKS_BLOCKED = { granted: false, canAskAgain: false, status: 'denied' }

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' })
  })
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS })
  })

  it('o sistema mostra o pedido e a pessoa permite → câmera, sem tela de bloqueio', async () => {
    camera.permission = LOOKS_BLOCKED
    camera.requestResult = { granted: true, canAskAgain: true, status: 'granted' }
    camera.requestDelayMs = 450
    const { queryByText, findByTestId } = render(<BarcodeScannerScreen />)
    expect(queryByText('A câmera está bloqueada para o Dosiq')).toBeNull()
    expect(await findByTestId('camera-view')).toBeTruthy()
    camera.requestDelayMs = 0
  })

  it('o sistema mostra o pedido e a pessoa nega → "Sem acesso à câmera", não "bloqueada"', async () => {
    camera.permission = LOOKS_BLOCKED
    camera.requestResult = LOOKS_BLOCKED
    camera.requestDelayMs = 450
    const { findByText, queryByText } = render(<BarcodeScannerScreen />)
    expect(await findByText('Sem acesso à câmera')).toBeTruthy()
    expect(queryByText('A câmera está bloqueada para o Dosiq')).toBeNull()
    camera.requestDelayMs = 0
  })

  it('o pedido volta na hora sem diálogo → bloqueada de verdade, com Ajustes', async () => {
    camera.permission = LOOKS_BLOCKED
    camera.requestResult = LOOKS_BLOCKED
    const { findByText } = render(<BarcodeScannerScreen />)
    expect(await findByText('A câmera está bloqueada para o Dosiq')).toBeTruthy()
    expect(mockLogEvent).toHaveBeenCalledWith('scan_permission', expect.objectContaining({ result: 'blocked' }))
  })
})

describe('retomar depois dos Ajustes (C-D1-6)', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  const { Linking, Platform } = require('react-native')
  const originalOS = Platform.OS
  const BLOCKED = { granted: false, canAskAgain: false, status: 'denied' }

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS })
  })

  it('iPhone: "Abrir Ajustes do celular" grava a marca antes de sair', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' })
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
    camera.permission = BLOCKED
    const { getByText } = render(<BarcodeScannerScreen />)
    await act(async () => {
      fireEvent.press(getByText('Abrir Ajustes do celular'))
    })
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@dosiq/scan-resume', expect.stringContaining('"entryPoint":"medicine_form"'))
    expect(settings).toHaveBeenCalled()
    settings.mockRestore()
  })

  it('Android não grava a marca (o processo sobrevive e a tela relê a permissão)', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' })
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
    camera.permission = BLOCKED
    camera.requestResult = BLOCKED
    const { findByText } = render(<BarcodeScannerScreen />)
    const button = await findByText('Abrir Ajustes do celular')
    await act(async () => {
      fireEvent.press(button)
    })
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('@dosiq/scan-resume', expect.anything())
    settings.mockRestore()
  })
})
