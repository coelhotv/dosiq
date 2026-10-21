import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * 096 B2 C-1 (PO 2026-10-21, opção a) — sem a caixa B, o bot do Telegram não responde com dado de
 * saúde: comandos (exceto /start e /ajuda), texto livre e callbacks recebem o aviso neutro, e o
 * handler NUNCA roda. Com B, o roteamento segue como hoje.
 */

const handlers = {
  handleStart: vi.fn(), handleStatus: vi.fn(), handleEstoque: vi.fn(), handleHoje: vi.fn(),
  handleProxima: vi.fn(), handleHistorico: vi.fn(), handleAjuda: vi.fn(), handleRegistrar: vi.fn(),
}
vi.mock('../../server/bot/commands/start.js', () => ({ handleStart: handlers.handleStart }))
vi.mock('../../server/bot/commands/status.js', () => ({ handleStatus: handlers.handleStatus }))
vi.mock('../../server/bot/commands/estoque.js', () => ({ handleEstoque: handlers.handleEstoque }))
vi.mock('../../server/bot/commands/hoje.js', () => ({ handleHoje: handlers.handleHoje }))
vi.mock('../../server/bot/commands/proxima.js', () => ({ handleProxima: handlers.handleProxima }))
vi.mock('../../server/bot/commands/historico.js', () => ({ handleHistorico: handlers.handleHistorico }))
vi.mock('../../server/bot/commands/ajuda.js', () => ({ handleAjuda: handlers.handleAjuda }))
vi.mock('../../server/bot/commands/registrar.js', () => ({ handleRegistrar: handlers.handleRegistrar }))
vi.mock('../../server/bot/commands/adicionar_estoque.js', () => ({ handleAdicionarEstoque: vi.fn(), handleReporShortcut: vi.fn() }))
vi.mock('../../server/bot/commands/protocols.js', () => ({ handlePausar: vi.fn(), handleRetomar: vi.fn() }))

const callbackListener = vi.fn()
vi.mock('../../server/bot/callbacks/doseActions.js', () => ({
  handleCallbacks: (bot: { on: (e: string, h: unknown) => void }) => bot.on('callback_query', callbackListener),
}))
vi.mock('../../server/bot/callbacks/conversational.js', () => ({ handleConversationalCallbacks: vi.fn() }))
vi.mock('../../server/observability/sentry.js', () => ({
  initSentry: vi.fn(), captureServerException: vi.fn(), flushSentry: vi.fn(),
  withServerIsolation: (fn: () => Promise<unknown>) => fn(),
}))

let settings: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('../../server/services/supabase.js', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => settings }) }) }) },
}))

const fetchSpy = vi.fn(async () => ({ json: async () => ({ ok: true, result: {} }) }))

function res() {
  const r: any = { statusCode: 0, body: null }
  r.status = (c: number) => { r.statusCode = c; return r }
  r.json = (b: any) => { r.body = b; return r }
  return r
}
const msg = (text: string) => ({ method: 'POST', body: { message: { chat: { id: 77 }, text } } })
const cb = () => ({ method: 'POST', body: { callback_query: { id: 'cq1', data: 'take_:p1:1', message: { chat: { id: 77 } } } } })
const telegramCalls = () => fetchSpy.mock.calls.map((c: any) => [String(c[0]).split('/').pop(), JSON.parse(c[1].body)])

let handler: any
beforeEach(async () => {
  vi.resetModules()
  process.env.TELEGRAM_BOT_TOKEN = 'tok'
  vi.stubGlobal('fetch', fetchSpy)
  handler = (await import('../telegram.js')).default
})
afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); vi.unstubAllGlobals() })

describe('api/telegram — gate da caixa B (096 C-1)', () => {
  const NO_B = { data: { international_transfer_granted_at: null }, error: null }
  const WITH_B = { data: { international_transfer_granted_at: '2026-10-21T10:00:00Z' }, error: null }

  it.each(['/hoje', '/estoque', '/historico', '/status', '/registrar', 'quanto tomo?'])(
    '🔴 sem B: "%s" ⇒ aviso neutro, handler não roda',
    async (text) => {
      settings = NO_B
      await handler(msg(text), res())
      expect(Object.values(handlers).some((h) => h.mock.calls.length > 0)).toBe(false)
      const [[method, body]] = telegramCalls()
      expect(method).toBe('sendMessage')
      expect(body.text).toContain('autorização de envio para fora do Brasil')
    },
  )

  it('🔴 leitura da flag falha ⇒ bloqueia (fail-closed por chat)', async () => {
    settings = { data: null, error: { message: 'timeout' } }
    await handler(msg('/hoje'), res())
    expect(handlers.handleHoje).not.toHaveBeenCalled()
  })

  it.each([['/start ABC123', 'handleStart'], ['/ajuda', 'handleAjuda']] as const)(
    'sem B: "%s" segue livre (não carrega dado de saúde)',
    async (text, name) => {
      settings = NO_B
      await handler(msg(text), res())
      expect(handlers[name]).toHaveBeenCalledTimes(1)
    },
  )

  it('🔴 sem B: callback de botão ⇒ alerta, listener não roda (não ecoa o nome do remédio)', async () => {
    settings = NO_B
    await handler(cb(), res())
    expect(callbackListener).not.toHaveBeenCalled()
    const [[method, body]] = telegramCalls()
    expect(method).toBe('answerCallbackQuery')
    expect(body.show_alert).toBe(true)
  })

  it('chat não vinculado ⇒ não bloqueia (o handler responde "conta não vinculada")', async () => {
    settings = { data: null, error: null }
    await handler(msg('/hoje'), res())
    expect(handlers.handleHoje).toHaveBeenCalledTimes(1)
  })

  it('com B ⇒ roteamento de hoje (comando e callback)', async () => {
    settings = WITH_B
    await handler(msg('/hoje'), res())
    await handler(cb(), res())
    expect(handlers.handleHoje).toHaveBeenCalledTimes(1)
    expect(callbackListener).toHaveBeenCalledTimes(1)
  })
})
