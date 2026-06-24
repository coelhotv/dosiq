// chatHistoryStore.test.js — persistência local do chat (spec 015 onda 2, FR-007).

import AsyncStorage from '@react-native-async-storage/async-storage'
import { loadHistory, saveHistory, clearHistory } from '../chatHistoryStore'
import { CHATBOT_MAX_HISTORY, CHATBOT_HISTORY_STORAGE_KEY } from '../../config/chatbotConfig'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

const msg = (i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}`, timestamp: 1000 + i })

afterEach(() => jest.clearAllMocks())

describe('chatHistoryStore', () => {
  it('loadHistory: sem dado → []', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    expect(await loadHistory()).toEqual([])
  })

  it('loadHistory: JSON inválido → [] (degrada, sem lançar)', async () => {
    AsyncStorage.getItem.mockResolvedValue('{ não é json')
    expect(await loadHistory()).toEqual([])
  })

  it('loadHistory: filtra entradas malformadas', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([
      msg(0), { role: 'user' }, { content: 'x', timestamp: 1 }, msg(1),
    ]))
    const r = await loadHistory()
    expect(r).toHaveLength(2)
    expect(r.map((m) => m.content)).toEqual(['m0', 'm1'])
  })

  it('saveHistory: corta para CHATBOT_MAX_HISTORY (mantém as mais recentes)', async () => {
    const many = Array.from({ length: CHATBOT_MAX_HISTORY + 10 }, (_, i) => msg(i))
    await saveHistory(many)
    const [key, payload] = AsyncStorage.setItem.mock.calls[0]
    expect(key).toBe(CHATBOT_HISTORY_STORAGE_KEY)
    const saved = JSON.parse(payload)
    expect(saved).toHaveLength(CHATBOT_MAX_HISTORY)
    expect(saved[saved.length - 1].content).toBe(`m${CHATBOT_MAX_HISTORY + 9}`)
  })

  it('saveHistory: filtra mensagens de erro (isError) — não poluem o histórico', async () => {
    await saveHistory([msg(0), { role: 'assistant', content: 'falha técnica', timestamp: 1002, isError: true }, msg(1)])
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1])
    expect(saved).toHaveLength(2)
    expect(saved.some((m) => m.isError)).toBe(false)
  })

  it('loadHistory: filtra mensagens de erro (isError) persistidas anteriormente', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([
      msg(0), { role: 'assistant', content: 'erro antigo', timestamp: 1002, isError: true },
    ]))
    const r = await loadHistory()
    expect(r).toHaveLength(1)
    expect(r[0].content).toBe('m0')
  })

  it('saveHistory: falha de escrita não lança', async () => {
    AsyncStorage.setItem.mockRejectedValue(new Error('disk full'))
    await expect(saveHistory([msg(0)])).resolves.toBeUndefined()
  })

  it('clearHistory: remove a chave', async () => {
    await clearHistory()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHATBOT_HISTORY_STORAGE_KEY)
  })
})
