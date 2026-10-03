// Endpoint do relatório em PDF (spec 097 A2, D-A2-2 — PO-SEC-6).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRateLimiter } from '../_report/rateLimit.js'
import { createReportHandler, type ReportHandlerDeps } from '../_report/handler.js'

const aqui = dirname(fileURLToPath(import.meta.url))

const INPUTS = {
  window: { from: '2026-09-04', to: '2026-10-03', days: 30 },
  timezone: 'America/Sao_Paulo',
  profile: { displayName: 'Ana Secreta', birthDate: null, allergies: ['Dipirona'], bloodType: null },
  stockTrackingEnabled: true,
  protocols: [],
  medicines: [],
  doseDays: [],
  titrationSteps: [],
  stockTotals: [],
  biomarkers: [],
  medicineLogs: [],
}

function fakeRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.body = body
      return res
    },
    send(body: unknown) {
      res.body = body
      return res
    },
    end() {
      return res
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value
      return res
    },
  }
  return res
}

function req(over: Partial<{ method: string; headers: Record<string, string>; query: Record<string, string>; body: unknown }> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer jwt-do-usuario' },
    query: {},
    body: { days: 30, to: '2026-10-03' },
    ...over,
  }
}

let deps: ReportHandlerDeps & {
  createClient: ReturnType<typeof vi.fn>
  getUser: ReturnType<typeof vi.fn>
  collect: ReturnType<typeof vi.fn>
  renderPdf: ReturnType<typeof vi.fn>
  warmUp: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null })
  const createClient = vi.fn(() => ({ auth: { getUser } }))
  deps = {
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'anon-key',
    createClient,
    getUser,
    collect: vi.fn().mockResolvedValue(INPUTS),
    renderPdf: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
    warmUp: vi.fn().mockResolvedValue(undefined),
    rateLimiter: createRateLimiter({ max: 5, windowMs: 60_000, now: () => 1_000 }),
    now: () => new Date('2026-10-03T15:00:00Z'),
  } as typeof deps
})

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('api/report — PO-SEC-6', () => {
  it('(a) POST sem Bearer → 401, sem tocar no banco', async () => {
    const res = fakeRes()
    await createReportHandler(deps)(req({ headers: {} }) as never, res as never)
    expect(res.statusCode).toBe(401)
    expect(deps.createClient).not.toHaveBeenCalled()
  })

  it('JWT inválido → 401', async () => {
    deps.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } })
    const res = fakeRes()
    await createReportHandler(deps)(req() as never, res as never)
    expect(res.statusCode).toBe(401)
    expect(deps.collect).not.toHaveBeenCalled()
  })

  it.each([[{ days: 45, to: '2026-10-03' }], [{ days: 30, to: '03/10/2026' }], [{ days: 30, to: '2026-12-25' }], [null]])(
    '(b) corpo inválido %j → 400',
    async (body) => {
      const res = fakeRes()
      await createReportHandler(deps)(req({ body }) as never, res as never)
      expect(res.statusCode).toBe(400)
      expect(deps.collect).not.toHaveBeenCalled()
    }
  )

  it('(c) client do coletor usa a chave anon + o JWT de quem chama; userId vem do token', async () => {
    const res = fakeRes()
    await createReportHandler(deps)(req() as never, res as never)
    expect(deps.createClient).toHaveBeenCalledWith(
      'https://x.supabase.co',
      'anon-key',
      expect.objectContaining({ global: { headers: { Authorization: 'Bearer jwt-do-usuario' } } })
    )
    const [, args] = deps.collect.mock.calls[0]
    expect(args).toEqual({ days: 30, to: '2026-10-03' })
    expect(await deps.collect.mock.calls[0][2]()).toBe('user-a')
  })

  it('sucesso → 200 application/pdf com nome sem o nome do paciente', async () => {
    const res = fakeRes()
    await createReportHandler(deps)(req() as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toBe('attachment; filename="dosiq-relatorio-30d-2026-10-03.pdf"')
    expect(res.headers['cache-control']).toBe('no-store')
    const html = deps.renderPdf.mock.calls[0][0] as string
    expect(html).toContain('Relatório de acompanhamento')
  })

  it('(d) GET ?warm=1 → 204 sem client nem leitura de banco', async () => {
    const res = fakeRes()
    await createReportHandler(deps)(req({ method: 'GET', headers: {}, query: { warm: '1' }, body: undefined }) as never, res as never)
    expect(res.statusCode).toBe(204)
    expect(deps.warmUp).toHaveBeenCalled()
    expect(deps.createClient).not.toHaveBeenCalled()
    expect(deps.collect).not.toHaveBeenCalled()
  })

  it('(e) 6ª chamada do mesmo usuário na janela → 429', async () => {
    const handler = createReportHandler(deps)
    const codes: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const res = fakeRes()
      await handler(req() as never, res as never)
      codes.push(res.statusCode)
    }
    expect(codes).toEqual([200, 200, 200, 200, 200, 429])
  })

  it('(f) erro na coleta → 500 só com error_code; sem conteúdo clínico no log', async () => {
    deps.collect.mockRejectedValue(new Error('Glifage da Ana Secreta falhou'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = fakeRes()
    await createReportHandler(deps)(req() as never, res as never)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'report_failed', error_code: 'collect' })
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/Glifage|Ana/)
    log.mockRestore()
  })

  it('erro na geração do PDF → error_code "render"', async () => {
    deps.renderPdf.mockRejectedValue(new Error('chromium'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = fakeRes()
    await createReportHandler(deps)(req() as never, res as never)
    expect(res.body).toEqual({ error: 'report_failed', error_code: 'render' })
  })

  it('método não suportado → 405', async () => {
    const res = fakeRes()
    await createReportHandler(deps)(req({ method: 'PUT' }) as never, res as never)
    expect(res.statusCode).toBe(405)
  })
})

describe('api/report — guardas estruturais', () => {
  const fontes = ['../report.ts', '../_report/handler.ts', '../_report/renderPdf.ts'].map((p) => readFileSync(resolve(aqui, p), 'utf8'))

  it('nenhum uso de service role (RLS do próprio usuário)', () => {
    for (const f of fontes) expect(f).not.toMatch(/SERVICE_ROLE/)
  })

  it('(g) Chromium com JavaScript desligado e rede bloqueada', () => {
    const render = fontes[2]
    expect(render).toContain('setJavaScriptEnabled(false)')
    expect(render).toContain('setRequestInterception(true)')
  })

  it('sem o demo do spike', () => {
    for (const f of fontes) expect(f).not.toMatch(/demo/i)
  })
})
