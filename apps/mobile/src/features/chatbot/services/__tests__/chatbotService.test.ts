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
    expect(payload).toEqual({ has_error: false })
    expect(JSON.stringify(payload)).not.toMatch(/pergunta sensível|resposta sensível/)
  })

  it('erro HTTP: emite has_error:true, sem texto', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch

    await sendChatMessage({ message: 'pergunta', patientContext: 'ctx' })

    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.AI_ASSISTANT_MESSAGE_SENT, { has_error: true })
  })

  it('sem access token: NÃO emite (usuário nem chegou a enviar)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await sendChatMessage({ message: 'pergunta', patientContext: 'ctx' })

    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})
