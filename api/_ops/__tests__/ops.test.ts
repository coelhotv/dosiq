import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * 107 PO-7 + PO-SEC-2 — contrato do api/ops: allowlist (400), segredo em tempo constante (401,
 * header nunca logado), job que lança ou aborta ⇒ 5xx (o cron-job.org alerta).
 */

vi.mock('../pruneEnqueue.js', () => ({ runPruneEnqueue: vi.fn() }))
vi.mock('../pruneExecute.js', () => ({ runPruneExecute: vi.fn() }))
vi.mock('../../../server/observability/sentry.js', () => ({
  initSentry: vi.fn(), captureServerException: vi.fn(), flushSentry: vi.fn(async () => {}),
}))

const SEGREDO = 'segredo-do-cron-107'

function resFake() {
  const res: any = { statusCode: 0, body: null }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

let handler: any
let enqueue: any
let execute: any

beforeEach(async () => {
  vi.resetModules()
  process.env.CRON_SECRET = SEGREDO
  process.env.SUPABASE_URL = 'http://localhost'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  handler = (await import('../../ops.js')).default
  enqueue = (await import('../pruneEnqueue.js')).runPruneEnqueue
  execute = (await import('../pruneExecute.js')).runPruneExecute
})

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

const req = (job: string, auth?: string) => ({ method: 'GET', query: { job }, headers: auth === undefined ? {} : { authorization: auth } })

describe('api/ops', () => {
  it('sem segredo / segredo errado / quase-certo ⇒ 401 e o header nunca vai para log', async () => {
    const logs: any[] = []
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a: any[]) => { logs.push(a) }))
    for (const auth of [undefined, 'Bearer errado', `Bearer ${SEGREDO.slice(0, -1)}`]) {
      const res = resFake()
      await handler(req('prune_execute', auth), res)
      expect(res.statusCode).toBe(401)
    }
    spies.forEach((s) => s.mockRestore())
    expect(logs.length).toBeGreaterThan(0)
    expect(JSON.stringify(logs)).not.toContain(SEGREDO.slice(0, -1))
    expect(execute).not.toHaveBeenCalled()
  })

  it('job fora da allowlist ⇒ 400 (inclusive nome de propriedade herdada)', async () => {
    for (const job of ['consent_prune', 'toString', '__proto__', '']) {
      const res = resFake()
      await handler(req(job, `Bearer ${SEGREDO}`), res)
      expect(res.statusCode).toBe(400)
    }
  })

  it('job que lança ⇒ 500; job que aborta ⇒ 500; ok ⇒ 200', async () => {
    execute.mockRejectedValueOnce(new Error('boom'))
    let res = resFake()
    await handler(req('prune_execute', `Bearer ${SEGREDO}`), res)
    expect(res.statusCode).toBe(500)

    execute.mockResolvedValueOnce({ aborted: true, reason: 'cap_exceeded' })
    res = resFake()
    await handler(req('prune_execute', `Bearer ${SEGREDO}`), res)
    expect(res.statusCode).toBe(500)

    enqueue.mockResolvedValueOnce({ enqueued: 0 })
    res = resFake()
    await handler(req('prune_enqueue', `Bearer ${SEGREDO}`), res)
    expect(res.statusCode).toBe(200)
  })
})
