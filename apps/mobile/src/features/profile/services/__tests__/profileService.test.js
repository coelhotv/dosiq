import { getCurrentUser, logoutUser, getUserSettings, generateTelegramToken, completeOnboarding, captureDeviceTimezone } from '../profileService'
import { supabase } from '../../../../platform/supabase/nativeSupabaseClient'

// Mock supabase
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => {
  const maybeSingleMock = jest.fn()
  const eqMock = jest.fn(() => ({ maybeSingle: maybeSingleMock }))
  const selectMock = jest.fn(() => ({ eq: eqMock }))
  const upsertMock = jest.fn(() => Promise.resolve({ error: null }))
  const fromMock = jest.fn(() => ({ select: selectMock, upsert: upsertMock }))
  const rpcMock = jest.fn()
  const getUserMock = jest.fn()
  const getSessionMock = jest.fn()
  const signOutMock = jest.fn()

  return {
    supabase: {
      auth: {
        getUser: getUserMock,
        getSession: getSessionMock,
        signOut: signOutMock,
      },
      from: fromMock,
      rpc: rpcMock,
    }
  }
})

describe('profileService', () => {
  const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    jest.clearAllMocks()
    global.__DEV__ = true
    
    // Default success mocks
    supabase.auth.getUser.mockResolvedValue({ 
      data: { user: { id: VALID_USER_ID, email: 'test@example.com' } }, 
      error: null 
    })
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: VALID_USER_ID } } },
      error: null
    })
  })

  describe('getCurrentUser', () => {
    it('deve retornar dados do usuário com sucesso', async () => {
      const res = await getCurrentUser()
      expect(res.data.id).toBe(VALID_USER_ID)
      expect(res.error).toBeNull()
    })
  })

  describe('logoutUser', () => {
    it('deve retornar success true ao deslogar', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: null })
      const res = await logoutUser()
      expect(res.success).toBe(true)
    })
  })

  describe('getUserSettings', () => {
    it('deve retornar settings do usuário', async () => {
      // Accessing chainable mock through supabase.from().select().eq()
      const mockMaybeSingle = supabase.from().select().eq().maybeSingle
      mockMaybeSingle.mockResolvedValue({ 
        data: { user_id: VALID_USER_ID, telegram_chat_id: 'chat123' }, 
        error: null 
      })

      const res = await getUserSettings()
      expect(res.error).toBeNull()
      expect(res.data.telegram_chat_id).toBe('chat123')
    })

    it('deve retornar objeto default se não houver settings', async () => {
      const mockMaybeSingle = supabase.from().select().eq().maybeSingle
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })
      
      const res = await getUserSettings()
      expect(res.error).toBeNull()
      expect(res.data.telegram_chat_id).toBeNull()
    })
  })

  describe('generateTelegramToken', () => {
    it('deve chamar rpc generate_telegram_token', async () => {
      supabase.rpc.mockResolvedValue({ data: 'TOKEN123', error: null })

      const res = await generateTelegramToken()
      expect(supabase.rpc).toHaveBeenCalledWith('generate_telegram_token')
      expect(res.token).toBe('TOKEN123')
    })
  })

  // F4.3f.0 — captura silenciosa do fuso do device ao concluir onboarding.
  describe('completeOnboarding', () => {
    let intlSpy
    afterEach(() => {
      intlSpy?.mockRestore()
    })

    it('grava o fuso do device (suportado) no upsert', async () => {
      intlSpy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'Europe/London' }),
      })
      const res = await completeOnboarding()
      expect(res.success).toBe(true)
      const upsertMock = supabase.from().upsert
      const row = upsertMock.mock.calls.at(-1)[0]
      expect(row).toMatchObject({ user_id: VALID_USER_ID, onboarding_completed: true, timezone: 'Europe/London' })
    })

    it('fuso do device não suportado → grava São Paulo', async () => {
      intlSpy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'Asia/Tokyo' }),
      })
      await completeOnboarding()
      const row = supabase.from().upsert.mock.calls.at(-1)[0]
      expect(row.timezone).toBe('America/Sao_Paulo')
    })
  })

  // F4.3f.0 — captura no signup (ponto primário, antes do onboarding).
  describe('captureDeviceTimezone', () => {
    let intlSpy
    afterEach(() => {
      intlSpy?.mockRestore()
    })

    it('upsert só do fuso do device (suportado)', async () => {
      intlSpy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'America/New_York' }),
      })
      const res = await captureDeviceTimezone()
      expect(res.success).toBe(true)
      const row = supabase.from().upsert.mock.calls.at(-1)[0]
      expect(row).toEqual({ user_id: VALID_USER_ID, timezone: 'America/New_York' })
    })
  })
})
