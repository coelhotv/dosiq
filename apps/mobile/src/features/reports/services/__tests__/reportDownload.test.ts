// reportDownload.test.ts — spec 097 Slice B (PO-3, PO-4, PO-SEC-4, PO-SEC-5 mobile).
// Fronteiras mockadas: rede (fetch), expo-file-system, expo-sharing, expo-intent-launcher, analytics.

const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

const mockGetSession = jest.fn()
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getSession: (...a: unknown[]) => mockGetSession(...a) } },
}))

jest.mock('@platform/config/nativePublicAppConfig', () => ({ nativeApiBaseUrl: 'https://api.test' }))

// Arquivos "no disco" do mock: uri → bytes.
const mockDisk = new Map<string, Uint8Array>()
jest.mock('expo-file-system', () => {
  class File {
    uri: string
    contentUri: string
    constructor(dirOrUri: string | { uri: string }, name?: string) {
      this.uri = typeof dirOrUri === 'string' ? dirOrUri : `${dirOrUri.uri}/${name}`
      this.contentUri = `content://${this.uri}`
    }
    get exists() {
      return mockDisk.has(this.uri)
    }
    create() {
      mockDisk.set(this.uri, new Uint8Array())
    }
    write(bytes: Uint8Array) {
      mockDisk.set(this.uri, bytes)
    }
    delete() {
      if (!mockDisk.has(this.uri)) throw new Error('not found')
      mockDisk.delete(this.uri)
    }
  }
  return { File, Paths: { cache: { uri: 'file:///cache' } } }
})

const mockIsAvailable = jest.fn()
const mockShare = jest.fn()
jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...a: unknown[]) => mockIsAvailable(...a),
  shareAsync: (...a: unknown[]) => mockShare(...a),
}))

const mockStartActivity = jest.fn()
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: (...a: unknown[]) => mockStartActivity(...a),
}))

jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  getNow: () => new Date(2026, 9, 3, 23, 30), // 03/10 23h30 local — dia local, não UTC (R-020)
}))

import { Platform } from 'react-native'
import {
  deleteReportFile,
  fetchReportPdf,
  openReportFile,
  ReportDownloadError,
  shareReportFile,
} from '../reportDownload'
import { EVENTS } from '@platform/analytics/analyticsEvents'

const originalFetch = global.fetch
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46])

function okResponse(bytes = PDF, disposition: string | null = 'attachment; filename="dosiq-relatorio-30d-2026-10-03.pdf"') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-disposition' ? disposition : null) },
    arrayBuffer: async () => bytes.buffer.slice(0),
    json: async () => ({}),
  }
}

function errResponse(status: number, body: unknown = {}) {
  return { ok: false, status, headers: { get: () => null }, json: async () => body }
}

beforeEach(() => {
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'jwt-123' } } })
})

afterEach(() => {
  global.fetch = originalFetch
  mockDisk.clear()
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('fetchReportPdf (PO-3)', () => {
  it('POST com o JWT da sessão, days e `to` no dia local; grava os bytes no cache com o nome do servidor', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse()) as never
    const report = await fetchReportPdf(30)

    expect(global.fetch).toHaveBeenCalledWith('https://api.test/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-123' },
      body: JSON.stringify({ days: 30, to: '2026-10-03' }),
    })
    expect(report.uri).toBe('file:///cache/dosiq-relatorio-30d-2026-10-03.pdf')
    expect(Array.from(mockDisk.get(report.uri) ?? [])).toEqual(Array.from(PDF))
  })

  it('sem Content-Disposition usa o nome padrão, sem nome do paciente (PO-SEC-4)', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(PDF, null)) as never
    const report = await fetchReportPdf(7)
    expect(report.filename).toBe('dosiq-relatorio-7d-2026-10-03.pdf')
  })

  it('Content-Disposition com caminho é ignorado (nome fica no cache)', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(PDF, 'attachment; filename="../../x.pdf"')) as never
    const report = await fetchReportPdf(7)
    expect(report.filename).toBe('dosiq-relatorio-7d-2026-10-03.pdf')
  })

  it.each([
    [401, {}, 'auth'],
    [429, {}, 'rate_limited'],
    [500, { error_code: 'render' }, 'render'],
    [500, { error_code: 'collect' }, 'collect'],
  ])('HTTP %i vira erro %s, sem arquivo', async (status, body, code) => {
    global.fetch = jest.fn().mockResolvedValue(errResponse(status, body)) as never
    await expect(fetchReportPdf(30)).rejects.toMatchObject({ code })
    expect(mockDisk.size).toBe(0)
  })

  it('sem sessão: erro auth e nenhuma chamada de rede', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    global.fetch = jest.fn() as never
    await expect(fetchReportPdf(30)).rejects.toMatchObject({ code: 'auth' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('offline (fetch rejeita): erro network', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as never
    await expect(fetchReportPdf(30)).rejects.toMatchObject({ code: 'network' })
  })

  it('200 com corpo vazio: erro render, sem arquivo', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(new Uint8Array())) as never
    await expect(fetchReportPdf(30)).rejects.toMatchObject({ code: 'render' })
    expect(mockDisk.size).toBe(0)
  })
})

describe('eventos (PO-SEC-5 mobile)', () => {
  it('sucesso: report_generated só com chaves da allowlist', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse()) as never
    await fetchReportPdf(30)
    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.REPORT_GENERATED, {
      platform: 'mobile',
      surface: 'mobile',
      period: 30,
      duration_ms: expect.any(Number),
      size_bucket: 'lt_100k',
    })
  })

  it('erro: report_generation_error com error_code do vocabulário fechado', async () => {
    global.fetch = jest.fn().mockResolvedValue(errResponse(429)) as never
    await expect(fetchReportPdf(90)).rejects.toBeInstanceOf(ReportDownloadError)
    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.REPORT_GENERATION_ERROR, {
      platform: 'mobile',
      surface: 'mobile',
      period: 90,
      error_code: 'collect',
    })
  })
})

describe('shareReportFile (PO-4)', () => {
  it('disponível: abre o menu nativo com a uri do arquivo', async () => {
    mockIsAvailable.mockResolvedValue(true)
    mockShare.mockResolvedValue(undefined)
    await shareReportFile('file:///cache/r.pdf')
    expect(mockShare).toHaveBeenCalledWith('file:///cache/r.pdf', expect.objectContaining({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }))
  })

  it('indisponível: erro share_unavailable, sem abrir menu', async () => {
    mockIsAvailable.mockResolvedValue(false)
    await expect(shareReportFile('file:///cache/r.pdf')).rejects.toMatchObject({ code: 'share_unavailable' })
    expect(mockShare).not.toHaveBeenCalled()
  })
})

describe('deleteReportFile (PO-SEC-4)', () => {
  it('apaga o arquivo do cache', () => {
    mockDisk.set('file:///cache/r.pdf', PDF)
    deleteReportFile('file:///cache/r.pdf')
    expect(mockDisk.has('file:///cache/r.pdf')).toBe(false)
  })

  it('arquivo já apagado ou uri nula: não lança', () => {
    expect(() => deleteReportFile('file:///cache/nada.pdf')).not.toThrow()
    expect(() => deleteReportFile(null)).not.toThrow()
  })
})

describe('openReportFile (B-1)', () => {
  const originalOS = Platform.OS
  afterEach(() => {
    Platform.OS = originalOS
  })

  it('Android: ACTION_VIEW com content uri e permissão de leitura', async () => {
    Platform.OS = 'android'
    mockStartActivity.mockResolvedValue({})
    await openReportFile('file:///cache/r.pdf')
    expect(mockStartActivity).toHaveBeenCalledWith('android.intent.action.VIEW', {
      data: 'content://file:///cache/r.pdf',
      flags: 1,
      type: 'application/pdf',
    })
  })

  it('Android sem app de PDF: erro view_unavailable', async () => {
    Platform.OS = 'android'
    mockStartActivity.mockRejectedValue(new Error('No Activity found'))
    await expect(openReportFile('file:///cache/r.pdf')).rejects.toMatchObject({ code: 'view_unavailable' })
  })
})
