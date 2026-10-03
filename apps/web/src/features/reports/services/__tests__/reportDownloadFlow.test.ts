// Fluxo web do relatório em PDF gerado no servidor (spec 097 A2, D-A2-2 — FR-022, PO-SEC-5).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ track: vi.fn(), getSession: vi.fn() }))

vi.mock('@shared/utils/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession } } }))
vi.mock('@dashboard/services/analyticsService', () => ({ analyticsService: { track: mocks.track } }))

import {
  canShareReportFile,
  fetchClinicalReport,
  ReportFlowError,
  shareReportFile,
  warmReportEndpoint,
} from '../reportDownloadFlow'

function pdfResponse() {
  return new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
    status: 200,
    headers: { 'Content-Disposition': 'attachment; filename="dosiq-relatorio-30d-2026-10-03.pdf"' },
  })
}

describe('reportDownloadFlow', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-a' } } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse()))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.unstubAllGlobals()
  })

  it('POST com JWT da sessão, período e dia local; devolve File PDF com o nome do servidor', async () => {
    const report = await fetchClinicalReport(30)
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/report')
    expect(init.headers.Authorization).toBe('Bearer jwt-a')
    expect(JSON.parse(init.body)).toEqual({ days: 30, to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    expect(report.filename).toBe('dosiq-relatorio-30d-2026-10-03.pdf')
    expect(report.file.type).toBe('application/pdf')
  })

  it('evento de sucesso só com chaves da allowlist', async () => {
    await fetchClinicalReport(30)
    const [name, payload] = mocks.track.mock.calls[0]
    expect(name).toBe('report_generated')
    expect(Object.keys(payload).sort()).toEqual(['duration_ms', 'period', 'platform', 'size_bucket'])
  })

  it('sem sessão → erro "auth", sem chamar o servidor', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    await expect(fetchClinicalReport(30)).rejects.toMatchObject({ code: 'auth' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    [429, {}, 'rate_limited'],
    [500, { error_code: 'render' }, 'render'],
    [500, { error_code: 'collect' }, 'collect'],
  ])('resposta %i %j → código %s; evento de erro sem conteúdo', async (status, body, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
    await expect(fetchClinicalReport(7)).rejects.toMatchObject({ code })
    const [name, payload] = mocks.track.mock.calls[0]
    expect(name).toBe('report_generation_error')
    expect(Object.keys(payload).sort()).toEqual(['error_code', 'period', 'platform'])
  })

  it('rede caiu → ReportFlowError "collect"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const err = await fetchClinicalReport(30).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ReportFlowError)
    expect((err as ReportFlowError).code).toBe('collect')
  })

  it('warm dispara GET sem auth e engole falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')))
    expect(() => warmReportEndpoint()).not.toThrow()
    expect(fetch).toHaveBeenCalledWith('/api/report?warm=1')
  })

  it('compartilhar: cancelar não é erro; outra falha vira "share"', async () => {
    const file = { file: new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }), filename: 'a.pdf' }
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) })
    expect(canShareReportFile(file)).toBe(true)
    await expect(shareReportFile(file)).resolves.toBeUndefined()
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('boom')) })
    expect(canShareReportFile(file)).toBe(false)
    await expect(shareReportFile(file)).rejects.toMatchObject({ code: 'share' })
  })
})
