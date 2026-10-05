// profileService.analytics.test.ts — profile_updated/mode_changed sem PII (065 PR D / US6 / PO-6).
//
// Arquivo separado de profileService.test.ts: updateProfile/updateComplexity encadeiam
// .upsert().select().single() (createProfileRepository), forma diferente do upsert direto que o
// mock compartilhado daquele arquivo cobre — isolar evita arriscar os 20 testes já verdes lá.

const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
  resetUser: jest.fn(),
}))

const mockSingle = jest.fn()
const mockSelect = jest.fn(() => ({ single: mockSingle }))
const mockUpsert = jest.fn(() => ({ select: mockSelect }))
const mockFrom = jest.fn((_table: string) => ({ upsert: mockUpsert }))
const mockGetUser = jest.fn()

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: () => mockGetUser() }, from: (name: string) => mockFrom(name) },
}))

import { updateProfile, updateComplexity } from '../profileService'
import { EVENTS } from '@platform/analytics/analyticsEvents'

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('profileService — profile_updated/mode_changed sem PII', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null })
    mockSingle.mockResolvedValue({ data: { display_name: 'Ana', complexity_override: null }, error: null })
  })

  it('updateProfile: emite profile_updated com payload VAZIO — zero PII', async () => {
    await updateProfile({ display_name: 'Ana' })

    const calls = mockLogEvent.mock.calls.filter(([n]) => n === EVENTS.PROFILE_UPDATED)
    expect(calls).toEqual([[EVENTS.PROFILE_UPDATED, { surface: 'mobile' }]])
    expect(JSON.stringify(calls)).not.toMatch(/Ana/)
  })

  it('updateProfile: falha na escrita → NÃO emite', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await updateProfile({ display_name: 'Ana' })
    expect(mockLogEvent).not.toHaveBeenCalledWith(EVENTS.PROFILE_UPDATED, expect.anything())
  })

  it('updateComplexity: emite mode_changed com o enum, nunca PII', async () => {
    await updateComplexity('complex')

    const calls = mockLogEvent.mock.calls.filter(([n]) => n === EVENTS.MODE_CHANGED)
    expect(calls).toEqual([[EVENTS.MODE_CHANGED, { mode: 'complex', surface: 'mobile' }]])
  })

  it('updateComplexity(null): emite mode_changed{auto} — mesma normalização da super property', async () => {
    await updateComplexity(null)
    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.MODE_CHANGED, { mode: 'auto', surface: 'mobile' })
  })
})
