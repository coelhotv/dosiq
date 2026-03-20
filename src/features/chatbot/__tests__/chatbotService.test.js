import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Mock global fetch antes dos imports
const mockFetch = vi.fn()
global.fetch = mockFetch

import { sendChatMessage } from '../services/chatbotService'

const mockPatientData = {
  medicines: [{ id: '1', name: 'Metformina', dosage_per_pill: 500, dosage_unit: 'mg', stock: [] }],
  protocols: [],
  logs: [],
  stockSummary: [],
  stats: { adherence: 0.9 },
}

beforeEach(() => {
  // Limpar rate limit entre testes
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('mr_chat_rate')
  }
  mockFetch.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('sendChatMessage', () => {
  it('retorna blocked=true para mensagem perigosa', async () => {
    const result = await sendChatMessage({
      message: 'qual dosagem devo tomar?',
      history: [],
      patientData: mockPatientData,
    })
    expect(result.blocked).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('envia mensagem para /api/chatbot', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Sua adesao esta otima!' }),
    })

    const result = await sendChatMessage({
      message: 'como esta minha adesao?',
      history: [],
      patientData: mockPatientData,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chatbot',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.blocked).toBe(false)
    expect(result.rateLimited).toBe(false)
  })

  it('adiciona disclaimer na resposta sobre medicamento', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Seu medicamento foi tomado hoje.' }),
    })

    const result = await sendChatMessage({
      message: 'tomei meu remedio?',
      history: [],
      patientData: mockPatientData,
    })

    expect(result.response).toContain('Não substituo')
  })

  it('lida com erro de rede gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await sendChatMessage({
      message: 'ola',
      history: [],
      patientData: mockPatientData,
    })

    expect(result.blocked).toBe(false)
    expect(result.rateLimited).toBe(false)
    expect(result.response).toContain('dificuldades técnicas')
  })

  it('lida com HTTP 429 (rate limit Groq)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Too many requests' }),
    })

    const result = await sendChatMessage({
      message: 'ola',
      history: [],
      patientData: mockPatientData,
    })

    expect(result.response).toContain('dificuldades técnicas')
  })

  it('limita historico a 10 mensagens enviadas ao servidor', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Ok!' }),
    })

    const longHistory = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`,
    }))

    await sendChatMessage({
      message: 'ola',
      history: longHistory,
      patientData: mockPatientData,
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.history.length).toBeLessThanOrEqual(10)
  })

  it('retorna rateLimited=true apos 30 mensagens na hora', async () => {
    // Simular 30 mensagens ja enviadas na janela atual
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        'mr_chat_rate',
        JSON.stringify({ windowStart: Date.now(), count: 30 })
      )
    }

    const result = await sendChatMessage({
      message: 'ola',
      history: [],
      patientData: mockPatientData,
    })

    expect(result.rateLimited).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
