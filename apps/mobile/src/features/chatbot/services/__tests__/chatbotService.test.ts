// chatbotService.test.ts — ai_assistant_message_sent só meta, zero texto (065 PR D / US6 / PO-6).

const mockLogEvent = jest.fn()
jest.mock('../../../../platform/analytics/productAnalytics', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

const mockGetSession = jest.fn()
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getSession: (...a: unknown[]) => mockGetSession(...a) } },
}))

jest.mock('../../../../platform/config/nativePublicAppConfig', () => ({
  nativeApiBaseUrl: 'https://api.test',
}))

jest.mock('@dosiq/core', () => ({
  fetchChatbotContextData: jest.fn(),
  buildPatientContext: jest.fn(),
}))

import { sendChatMessage } from '../chatbotService'
import { EVENTS } from '../../../../platform/analytics/analyticsEvents'

const originalFetch = global.fetch

describe('chatbotService — ai_assistant_message_sent (PO-6)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sucesso: emite has_error:false, zero texto de pergunta/resposta no payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'resposta sensível do LLM' }),
    }) as unknown as typeof fetch

    await sendChatMessage({ message: 'pergunta sensível do paciente', patientContext: 'ctx' })

    expect(mockLogEvent).toHaveBeenCalledTimes(1)
    const [event, payload] = mockLogEvent.mock.calls[0]
    expect(event).toBe(EVENTS.AI_ASSISTANT_MESSAGE_SENT)
    expect(payload).toEqual({ has_error: false, surface: 'mobile' })
    expect(JSON.stringify(payload)).not.toMatch(/pergunta sensível|resposta sensível/)
  })

  // 092 FR-006 / PO-4: error_kind por ramo, nunca a mensagem do servidor.
  const SERVER_MSG = 'detalhe interno do servidor'
  it.each([
    ['http_4xx', () => Promise.resolve({ ok: false, status: 429, json: async () => ({ message: SERVER_MSG }) })],
    ['http_5xx', () => Promise.resolve({ ok: false, status: 500, json: async () => ({ message: SERVER_MSG }) })],
    ['http_5xx', () => Promise.resolve({ ok: false, status: 503, json: async () => { throw new Error(SERVER_MSG) } })],
    ['network', () => Promise.reject(new TypeError('Network request failed'))],
    ['invalid_response', () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError(SERVER_MSG) } })],
  ])('falha → error_kind %s, sem texto de erro', async (kind, impl) => {
    global.fetch = jest.fn().mockImplementation(impl) as unknown as typeof fetch

    await sendChatMessage({ message: 'pergunta', patientContext: 'ctx' })

    expect(mockLogEvent.mock.calls).toEqual([
      [EVENTS.AI_ASSISTANT_MESSAGE_SENT, { has_error: true, error_kind: kind, surface: 'mobile' }],
    ])
    expect(JSON.stringify(mockLogEvent.mock.calls)).not.toMatch(/detalhe interno|Network request/)
  })

  it('sem access token: NÃO emite (usuário nem chegou a enviar)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await sendChatMessage({ message: 'pergunta', patientContext: 'ctx' })

    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})
