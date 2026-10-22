// sentryScrub.test.ts — o relatório do Sentry a partir da 0.34 não leva conteúdo (spec 096, PO-SEC-4).
//
// Política v0.4 §6: "A partir da versão 0.34, o relatório não inclui o conteúdo das consultas ao banco
// de dados, as mensagens internas do app, o seu e-mail nem o seu IP." Fixtures reais: URL PostgREST
// com filtros, console com nome de remédio, erro de validação com valor.
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { scrubEvent, scrubBreadcrumb, redactText } from '../sentryScrub'

// Fixture solta (formato do evento do SDK): o teste olha campos livres do resultado.
const scrub = (e: unknown): any => scrubEvent(e as never)

const POSTGREST_URL =
  'https://abc.supabase.co/rest/v1/medicines?select=id,name,dosage_per_pill&user_id=eq.b0c9746c-1111-2222-3333-444455556666&name=ilike.%25losartana%25'

const FORBIDDEN = ['?', 'eq.', 'ilike.', '@', 'apikey', 'Losartana', 'losartana']

function assertClean(value: unknown) {
  const text = JSON.stringify(value)
  for (const token of FORBIDDEN) expect(text).not.toContain(token)
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('scrubBreadcrumb', () => {
  it('console é descartado (pode carregar nome de remédio)', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'Losartana 50 mg salva' })).toBeNull()
  })

  it('http/fetch/xhr: URL sem query, sem corpo', () => {
    const out = scrubBreadcrumb({
      type: 'http',
      category: 'fetch',
      data: { url: POSTGREST_URL, method: 'GET', status_code: 400, body: '{"name":"Losartana"}' },
    })
    expect(out?.data).toEqual({ url: 'https://abc.supabase.co/rest/v1/medicines', method: 'GET', status_code: 400 })
    assertClean(out)
  })

  it('navigation: só a rota', () => {
    const out = scrubBreadcrumb({ category: 'navigation', data: { from: 'Today?x=1', to: 'Chat?q=dor' } })
    expect(out?.data).toEqual({ from: 'Today', to: 'Chat' })
  })

  it('outros: mensagem redigida, data removida', () => {
    const out = scrubBreadcrumb({ category: 'ui', message: 'erro paciente@example.com', data: { medicine: 'Losartana' } })
    expect(out?.data).toBeUndefined()
    assertClean(out)
  })
})

describe('scrubEvent', () => {
  const raw = () => ({
    message: `Falha em ${POSTGREST_URL}`,
    exception: {
      values: [
        { type: 'ZodError', value: 'name: "Losartana" inválido; contato paciente@example.com; filtro id=eq.123', stacktrace: { frames: [{ function: 'save' }] } },
      ],
    },
    request: {
      url: POSTGREST_URL,
      method: 'POST',
      query_string: 'user_id=eq.1',
      data: { name: 'Losartana' },
      cookies: { sb: 'x' },
      headers: { Authorization: 'Bearer t', apikey: 'k' },
    },
    extra: { payload: { name: 'Losartana' } },
    user: { id: 'u-1', email: 'paciente@example.com', ip_address: '1.2.3.4', username: 'eu' },
    breadcrumbs: [
      { category: 'console', message: 'Losartana' },
      { type: 'http', category: 'xhr', data: { url: POSTGREST_URL, method: 'GET' } },
    ],
    tags: { update_id: 'abc', channel: 'production' },
  })

  it('remove query, corpo, headers, cookies, extra, e-mail e IP', () => {
    const out = scrub(raw())
    expect(out.request).toEqual({ url: 'https://abc.supabase.co/rest/v1/medicines', method: 'POST' })
    expect(out.extra).toBeUndefined()
    expect(out.user).toEqual({ id: 'u-1', ip_address: null })
    expect(out.breadcrumbs).toHaveLength(1)
    assertClean({ message: out.message, exception: out.exception, request: out.request, breadcrumbs: out.breadcrumbs, user: out.user })
  })

  it('guarda: stack, tipo e tags chegam intactos', () => {
    const out = scrub(raw())
    expect(out.exception.values[0].type).toBe('ZodError')
    expect(out.exception.values[0].stacktrace).toEqual({ frames: [{ function: 'save' }] })
    expect(out.tags).toEqual({ update_id: 'abc', channel: 'production' })
  })

  it('crash sem request/breadcrumbs/usuário não quebra', () => {
    const out = scrub({ exception: { values: [{ type: 'Error', value: 'boom' }] } })
    expect(out.exception.values[0].value).toBe('boom')
    expect(out.user).toEqual({ ip_address: null })
  })
})

describe('redactText', () => {
  it('pontuação normal sobrevive', () => {
    expect(redactText('Tem certeza? Sim.')).toBe('Tem certeza? Sim.')
  })
  it('null/undefined passam', () => {
    expect(redactText(undefined)).toBeUndefined()
  })
})
