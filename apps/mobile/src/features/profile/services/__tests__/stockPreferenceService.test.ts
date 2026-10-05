// stockPreferenceService.test.ts — dedupe do stock_opt_in (065 PR D / US9 / PO-12).
//
// Guard da PO-12: chooseStockModeInOnboarding NUNCA emite STOCK_OPT_IN (o evento real é de
// activateStockWithInitialBalance) — sem isto o SC-004 da spec 044 conta a pessoa 2x.
// Mock no nível do supabase client (não das factories do @dosiq/core — tentativa anterior nesta
// sessão travou o mock de factory numa interação Babel/jest-expo não identificada; registrado em
// process-friction.jsonl). Deixa createProfileRepository REAL rodar contra o client mockado.

const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

const mockSingle = jest.fn()
const mockSelect = jest.fn(() => ({ single: mockSingle }))
const mockUpsert = jest.fn(() => ({ select: mockSelect }))
const mockFrom = jest.fn((_table: string) => ({ upsert: mockUpsert }))
const mockGetUser = jest.fn()

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: () => mockGetUser() }, from: (name: string) => mockFrom(name) },
}))

import { chooseStockModeInOnboarding } from '../stockPreferenceService'
import { EVENTS } from '@platform/analytics/analyticsEvents'

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('stockPreferenceService — dedupe stock_opt_in (PO-12)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
    mockSingle.mockResolvedValue({ data: { stock_tracking_enabled: true, stock_paused_at: null }, error: null })
  })

  it('chooseStockModeInOnboarding(true) NÃO emite STOCK_OPT_IN — só STOCK_ONBOARDING_CHOICE', async () => {
    await chooseStockModeInOnboarding(true)
    const optInCalls = mockLogEvent.mock.calls.filter(([event]) => event === EVENTS.STOCK_OPT_IN)
    expect(optInCalls).toHaveLength(0)
    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.STOCK_ONBOARDING_CHOICE, { mode: 'stock', stock_mode: 'stock', surface: 'mobile' })
  })

  it('chooseStockModeInOnboarding(false) também não emite STOCK_OPT_IN', async () => {
    await chooseStockModeInOnboarding(false)
    const optInCalls = mockLogEvent.mock.calls.filter(([event]) => event === EVENTS.STOCK_OPT_IN)
    expect(optInCalls).toHaveLength(0)
    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.STOCK_ONBOARDING_CHOICE, { mode: 'dose_only', stock_mode: 'dose_only', surface: 'mobile' })
  })
})
