// useReportGeneration.test.ts — spec 097 Slice B (PO-12 estados, PO-SEC-4 limpeza, B-1 visualizar).
import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

const mockFetch = jest.fn()
const mockDelete = jest.fn()
const mockShare = jest.fn()
const mockOpen = jest.fn()
const mockWarm = jest.fn()

jest.mock('../../services/reportDownload', () => {
  const actual = jest.requireActual('../../services/reportDownload')
  return {
    ReportDownloadError: actual.ReportDownloadError,
    fetchReportPdf: (...a: unknown[]) => mockFetch(...a),
    deleteReportFile: (...a: unknown[]) => mockDelete(...a),
    shareReportFile: (...a: unknown[]) => mockShare(...a),
    openReportFile: (...a: unknown[]) => mockOpen(...a),
    warmReportEndpoint: () => mockWarm(),
  }
})

// O serviço real importa módulos nativos; o requireActual acima só precisa da classe de erro.
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: {} } }))
jest.mock('expo-sharing', () => ({}))
jest.mock('expo-intent-launcher', () => ({}))
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: {} } }))
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: jest.fn() }))

import { useReportGeneration } from '../useReportGeneration'
import { ReportDownloadError } from '../../services/reportDownload'

const PDF_A = { uri: 'file:///cache/a.pdf', filename: 'a.pdf' }
const PDF_B = { uri: 'file:///cache/b.pdf', filename: 'b.pdf' }

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

describe('useReportGeneration — estados (PO-12)', () => {
  it('começa em idle com 30 dias e aquece o endpoint', () => {
    const { result } = renderHook(() => useReportGeneration())
    expect(result.current.status).toBe('idle')
    expect(result.current.period).toBe(30)
    expect(mockWarm).toHaveBeenCalledTimes(1)
  })

  it('carregando bloqueia o 2º toque; sucesso vai a ready', async () => {
    const d = deferred<typeof PDF_A>()
    mockFetch.mockReturnValue(d.promise)
    const { result } = renderHook(() => useReportGeneration())

    let first: Promise<void>
    act(() => {
      first = result.current.generate()
      void result.current.generate()
    })
    expect(result.current.status).toBe('loading')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      d.resolve(PDF_A)
      await first
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.report).toEqual(PDF_A)
  })

  it('erro mostra mensagem em linguagem simples e tentar de novo mantém o período', async () => {
    mockFetch.mockRejectedValueOnce(new ReportDownloadError('network')).mockResolvedValueOnce(PDF_A)
    const { result } = renderHook(() => useReportGeneration())
    act(() => result.current.setPeriod(90))

    await act(async () => {
      await result.current.generate()
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/Sem conexão/)
    expect(result.current.period).toBe(90)

    await act(async () => {
      await result.current.generate()
    })
    expect(mockFetch).toHaveBeenNthCalledWith(2, 90)
    expect(result.current.status).toBe('ready')
  })
})

describe('useReportGeneration — limpeza do arquivo (PO-SEC-4)', () => {
  it('gerar outro apaga o anterior', async () => {
    mockFetch.mockResolvedValueOnce(PDF_A).mockResolvedValueOnce(PDF_B)
    const { result } = renderHook(() => useReportGeneration())
    await act(async () => {
      await result.current.generate()
    })
    await act(async () => {
      await result.current.generate()
    })
    expect(mockDelete).toHaveBeenCalledWith(PDF_A.uri)
    expect(result.current.report).toEqual(PDF_B)
  })

  it('trocar de período depois de pronto apaga o arquivo e volta a idle', async () => {
    mockFetch.mockResolvedValue(PDF_A)
    const { result } = renderHook(() => useReportGeneration())
    await act(async () => {
      await result.current.generate()
    })
    act(() => result.current.setPeriod(7))
    expect(mockDelete).toHaveBeenCalledWith(PDF_A.uri)
    expect(result.current.status).toBe('idle')
  })

  it('sair da tela apaga o arquivo', async () => {
    mockFetch.mockResolvedValue(PDF_A)
    const { result, unmount } = renderHook(() => useReportGeneration())
    await act(async () => {
      await result.current.generate()
    })
    unmount()
    expect(mockDelete).toHaveBeenCalledWith(PDF_A.uri)
  })

  it('sair com o menu de compartilhar aberto: só apaga depois que o menu fecha (guard)', async () => {
    mockFetch.mockResolvedValue(PDF_A)
    const menu = deferred<void>()
    mockShare.mockReturnValue(menu.promise)
    const { result, unmount } = renderHook(() => useReportGeneration())
    await act(async () => {
      await result.current.generate()
    })
    let sharing: Promise<void>
    act(() => {
      sharing = result.current.share()
    })
    unmount()
    expect(mockDelete).not.toHaveBeenCalledWith(PDF_A.uri)
    await act(async () => {
      menu.resolve()
      await sharing
    })
    expect(mockDelete).toHaveBeenCalledWith(PDF_A.uri)
  })

  it('PDF que chega depois de sair da tela é apagado na hora', async () => {
    const d = deferred<typeof PDF_A>()
    mockFetch.mockReturnValue(d.promise)
    const { result, unmount } = renderHook(() => useReportGeneration())
    let gen: Promise<void>
    act(() => {
      gen = result.current.generate()
    })
    unmount()
    await act(async () => {
      d.resolve(PDF_A)
      await gen
    })
    expect(mockDelete).toHaveBeenCalledWith(PDF_A.uri)
  })
})

describe('useReportGeneration — Visualizar e Compartilhar (PO-4, B-1)', () => {
  it('compartilhar indisponível vira mensagem sem sair de pronto', async () => {
    mockFetch.mockResolvedValue(PDF_A)
    mockShare.mockRejectedValue(new ReportDownloadError('share_unavailable'))
    const { result } = renderHook(() => useReportGeneration())
    await act(async () => {
      await result.current.generate()
    })
    await act(async () => {
      await result.current.share()
    })
    expect(mockShare).toHaveBeenCalledWith(PDF_A.uri)
    expect(result.current.actionError).toMatch(/não disponível/)
    expect(result.current.status).toBe('ready')
  })

  it('iOS: visualizar entrega a uri ao DocumentViewer', async () => {
    Platform.OS = 'ios'
    mockFetch.mockResolvedValue(PDF_A)
    const { result } = renderHook(() => useReportGeneration())
    await act(async () => {
      await result.current.generate()
    })
    await act(async () => {
      await result.current.view()
    })
    expect(result.current.viewerUri).toBe(PDF_A.uri)
    expect(mockOpen).not.toHaveBeenCalled()
  })

  it('Android: visualizar abre o app de PDF; sem app, mensagem', async () => {
    Platform.OS = 'android'
    mockFetch.mockResolvedValue(PDF_A)
    mockOpen.mockRejectedValue(new ReportDownloadError('view_unavailable'))
    const { result } = renderHook(() => useReportGeneration())
    await act(async () => {
      await result.current.generate()
    })
    await act(async () => {
      await result.current.view()
    })
    expect(mockOpen).toHaveBeenCalledWith(PDF_A.uri)
    expect(result.current.viewerUri).toBeNull()
    expect(result.current.actionError).toMatch(/Nenhum app para abrir PDF/)
  })
})
