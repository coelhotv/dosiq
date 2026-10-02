// measurePrompt.test.ts — spec 069 A2 · PO-2 / PO-15 (regra pura + I/O do pedido de peso).
// Datas de fixture sempre LOCAIS (AP-270): new Date(y, m, d, h), nunca toISOString p/ derivar dia.

const mockGetNow = jest.fn()
jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  getNow: () => mockGetNow(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

const mockGetSession = jest.fn()
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}))

const mockGetLatest = jest.fn()
jest.mock('@measures/services/measuresRepo', () => ({
  measuresRepo: { getLatest: (...a: unknown[]) => mockGetLatest(...a) },
}))

import AsyncStorageImport from '@react-native-async-storage/async-storage'
import {
  MEASURE_PROMPT_POLICIES,
  shouldAskMeasure,
  periodKeyOf,
  promptStorageKey,
  resolvePostDoseStep,
  markPromptPeriod,
  isWeightEligible,
} from '../measurePrompt'

const AsyncStorage = AsyncStorageImport as unknown as { getItem: jest.Mock; setItem: jest.Mock }
const policy = MEASURE_PROMPT_POLICIES.peso

const INJ = { protocol: { frequency: 'diário', medicine: { presentation: 'injetavel' } } }
const WEEKLY = { protocol: { frequency: 'semanal', medicine: { presentation: 'comprimido' } } }
const DAILY = { protocol: { frequency: 'diário', medicine: { presentation: 'comprimido' } } }

// Quinta 01/10/2026 14:30 local
const NOW = new Date(2026, 9, 1, 14, 30)
const daysAgo = (n: number) => {
  const d = new Date(2026, 9, 1, 9, 0)
  d.setDate(d.getDate() - n)
  return d.toISOString() // instante (timestamptz), não dia — o dia é derivado local na regra
}

function ctx(over = {}) {
  return { items: [INJ], periodMarked: false, lastMeasuredAt: null, now: NOW, ...over }
}

beforeEach(() => {
  mockGetNow.mockReturnValue(NOW)
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } } })
  mockGetLatest.mockResolvedValue(null)
  AsyncStorage.getItem.mockResolvedValue(null)
  AsyncStorage.setItem.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('elegibilidade (semanal OU injetável)', () => {
  it('injetável diário e semanal oral são elegíveis; oral diário não', () => {
    expect(isWeightEligible(INJ)).toBe(true)
    expect(isWeightEligible(WEEKLY)).toBe(true)
    expect(isWeightEligible(DAILY)).toBe(false)
  })
  it('item sem protocolo/medicamento não quebra e não é elegível', () => {
    expect(isWeightEligible({ protocol: null })).toBe(false)
    expect(isWeightEligible({ protocol: { frequency: 'diário', medicine: null } })).toBe(false)
  })
  it('lote: basta um item elegível', () => {
    expect(shouldAskMeasure(policy, ctx({ items: [DAILY, INJ] }))).toBe(true)
    expect(shouldAskMeasure(policy, ctx({ items: [DAILY, DAILY] }))).toBe(false)
    expect(shouldAskMeasure(policy, ctx({ items: [] }))).toBe(false)
  })
})

describe('PO-15 — recência de 7 dias locais', () => {
  it('peso há 6 dias suprime', () => {
    expect(shouldAskMeasure(policy, ctx({ lastMeasuredAt: daysAgo(6) }))).toBe(false)
  })
  it('peso há 8 dias libera', () => {
    expect(shouldAskMeasure(policy, ctx({ lastMeasuredAt: daysAgo(8) }))).toBe(true)
  })
  it('peso há 7 dias libera (janela = hoje e os 6 anteriores)', () => {
    expect(shouldAskMeasure(policy, ctx({ lastMeasuredAt: daysAgo(7) }))).toBe(true)
  })
  it('getLatest rejeitado → pede', async () => {
    mockGetLatest.mockRejectedValue(new Error('TypeError: Network request failed'))
    const step = await resolvePostDoseStep({ items: [INJ] })
    expect(step).not.toBeNull()
    expect(step!.lastMeasure).toBeNull()
  })
  it('getLatest lento (timeout) → pede sem esperar', async () => {
    jest.useFakeTimers()
    mockGetLatest.mockReturnValue(new Promise(() => {}))
    const pending = resolvePostDoseStep({ items: [INJ] })
    await jest.advanceTimersByTimeAsync(2600)
    expect(await pending).not.toBeNull()
  })
  it('peso antigo vira lastMeasure com valor numérico (rodapé do passo 2)', async () => {
    mockGetLatest.mockResolvedValue({ measured_at: daysAgo(9), value: '86.0' })
    const step = await resolvePostDoseStep({ items: [INJ] })
    expect(step!.lastMeasure).toEqual({ value: 86, measuredAt: daysAgo(9) })
  })
  it('R-15: peso salvo no passo 2 e depois APAGADO (getLatest volta a null) reabre o pedido na mesma semana', async () => {
    mockGetLatest.mockResolvedValueOnce({ measured_at: daysAgo(0), value: 92 })
    expect(await resolvePostDoseStep({ items: [INJ] })).toBeNull()   // pesou hoje → suprime
    mockGetLatest.mockResolvedValueOnce(null)                        // apagou o único peso
    expect(await resolvePostDoseStep({ items: [INJ] })).not.toBeNull()
  })
  it('peso recente lido do repo suprime', async () => {
    mockGetLatest.mockResolvedValue({ measured_at: daysAgo(2) })
    expect(await resolvePostDoseStep({ items: [INJ] })).toBeNull()
    expect(mockGetLatest).toHaveBeenCalledWith('peso')
  })
})

describe('PO-2 — semana local (segunda) e marca por usuário', () => {
  it('domingo 23h GMT-3 e segunda 00h caem em semanas diferentes', () => {
    const sunday = periodKeyOf(policy, new Date(2026, 9, 4, 23, 0))
    const monday = periodKeyOf(policy, new Date(2026, 9, 5, 0, 0))
    expect(sunday).toBe('2026-09-28')
    expect(monday).toBe('2026-10-05')
  })
  it('chave carrega user_id e tipo', () => {
    expect(promptStorageKey('user-a', policy, '2026-09-28')).toBe('measurePrompt:user-a:peso:2026-09-28')
  })
  it('semana marcada suprime', async () => {
    AsyncStorage.getItem.mockImplementation(async (k: string) =>
      k === 'measurePrompt:user-a:peso:2026-09-28' ? '1' : null)
    expect(await resolvePostDoseStep({ items: [INJ] })).toBeNull()
  })
  it('outro user_id não herda a marca', async () => {
    AsyncStorage.getItem.mockImplementation(async (k: string) =>
      k === 'measurePrompt:user-a:peso:2026-09-28' ? '1' : null)
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-b' } } } })
    expect(await resolvePostDoseStep({ items: [INJ] })).not.toBeNull()
  })
  it('segunda nova libera mesmo com a semana anterior marcada', async () => {
    AsyncStorage.getItem.mockImplementation(async (k: string) =>
      k === 'measurePrompt:user-a:peso:2026-09-28' ? '1' : null)
    mockGetNow.mockReturnValue(new Date(2026, 9, 5, 8, 0))
    expect(await resolvePostDoseStep({ items: [INJ] })).not.toBeNull()
  })
  it('markPromptPeriod grava a chave da semana do passo', async () => {
    const step = await resolvePostDoseStep({ items: [INJ] })
    await markPromptPeriod(step!)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('measurePrompt:user-a:peso:2026-09-28', '1')
  })
  it('falha ao gravar a marca é engolida', async () => {
    AsyncStorage.setItem.mockRejectedValue(new Error('disk'))
    const step = await resolvePostDoseStep({ items: [INJ] })
    await expect(markPromptPeriod(step!)).resolves.toBeUndefined()
  })
  it('falha ao LER a marca → trata como livre (pede)', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('disk'))
    expect(await resolvePostDoseStep({ items: [INJ] })).not.toBeNull()
  })
})

describe('resolvePostDoseStep — curto-circuitos', () => {
  it('sem sessão → não pede', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    expect(await resolvePostDoseStep({ items: [INJ] })).toBeNull()
  })
  it('lote só de dose diária → null sem tocar I/O', async () => {
    expect(await resolvePostDoseStep({ items: [DAILY] })).toBeNull()
    expect(mockGetSession).not.toHaveBeenCalled()
    expect(mockGetLatest).not.toHaveBeenCalled()
  })
})
