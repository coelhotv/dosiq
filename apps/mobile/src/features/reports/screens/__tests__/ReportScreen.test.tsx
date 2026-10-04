// ReportScreen.test.tsx — spec 097 Slice B (PO-12): estados da tela e tela de pronto.
// Tela + hook reais; só o serviço (rede/arquivo/nativo) é mockado.
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'

const mockFetch = jest.fn()
const mockShare = jest.fn()
jest.mock('../../services/reportDownload', () => {
  const actual = jest.requireActual('../../services/reportDownload')
  return {
    ReportDownloadError: actual.ReportDownloadError,
    fetchReportPdf: (...a: unknown[]) => mockFetch(...a),
    shareReportFile: (...a: unknown[]) => mockShare(...a),
    openReportFile: jest.fn(),
    deleteReportFile: jest.fn(),
    warmReportEndpoint: jest.fn(),
  }
})
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: {} } }))
jest.mock('expo-sharing', () => ({}))
jest.mock('expo-intent-launcher', () => ({}))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: {} } }))
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: jest.fn() }))

import ReportScreen from '../ReportScreen'
import { ReportDownloadError } from '../../services/reportDownload'

const PDF = { uri: 'file:///cache/dosiq-relatorio-30d-2026-10-03.pdf', filename: 'x.pdf' }

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const originalOS = Platform.OS
afterEach(() => {
  Platform.OS = originalOS
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('ReportScreen (PO-12)', () => {
  it('períodos 7/30/90 com 30 selecionado e anunciado', () => {
    render(<ReportScreen />)
    expect(screen.getByLabelText('Últimos 30 dias').props.accessibilityState).toMatchObject({ selected: true })
    expect(screen.getByLabelText('Últimos 7 dias').props.accessibilityState).toMatchObject({ selected: false })
    expect(screen.getByLabelText('Últimos 90 dias')).toBeTruthy()
    expect(screen.queryByLabelText('Últimos 180 dias')).toBeNull()
  })

  it('carregando: indica progresso e bloqueia o 2º toque e a troca de período', async () => {
    const d = deferred<typeof PDF>()
    mockFetch.mockReturnValue(d.promise)
    render(<ReportScreen />)

    fireEvent.press(screen.getByLabelText('Gerar relatório'))
    fireEvent.press(screen.getByLabelText('Gerar relatório'))
    fireEvent.press(screen.getByLabelText('Últimos 90 dias'))

    expect(screen.getByText(/Gerando o relatório/)).toBeTruthy()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(30)
    expect(screen.getByLabelText('Últimos 30 dias').props.accessibilityState).toMatchObject({ selected: true })

    await act(async () => {
      d.resolve(PDF)
    })
  })

  it('erro: mensagem na tela + tentar de novo mantendo o período', async () => {
    mockFetch.mockRejectedValueOnce(new ReportDownloadError('network')).mockResolvedValueOnce(PDF)
    render(<ReportScreen />)
    fireEvent.press(screen.getByLabelText('Últimos 90 dias'))

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Gerar relatório'))
    })
    expect(screen.getByText(/Sem conexão com a internet/)).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Tentar de novo'))
    })
    expect(mockFetch).toHaveBeenNthCalledWith(2, 90)
    expect(screen.getByText('Relatório pronto')).toBeTruthy()
  })

  it('pronto: Visualizar e Salvar ou Compartilhar; compartilhar chama o menu com o arquivo', async () => {
    mockFetch.mockResolvedValue(PDF)
    mockShare.mockResolvedValue(undefined)
    render(<ReportScreen />)
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Gerar relatório'))
    })

    expect(screen.getByLabelText('Visualizar o relatório')).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Salvar ou Compartilhar o relatório'))
    })
    expect(mockShare).toHaveBeenCalledWith(PDF.uri)
    expect(screen.getByText(/O app não guarda o relatório/)).toBeTruthy()
  })

  it('iOS: Visualizar abre o PDF no visualizador do app', async () => {
    Platform.OS = 'ios'
    mockFetch.mockResolvedValue(PDF)
    render(<ReportScreen />)
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Gerar relatório'))
    })
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Visualizar o relatório'))
    })
    const web = screen.getByTestId('document-viewer-webview')
    expect(web.props.source).toEqual({ uri: PDF.uri })
    expect(web.props.javaScriptEnabled).toBe(false)
  })
})
