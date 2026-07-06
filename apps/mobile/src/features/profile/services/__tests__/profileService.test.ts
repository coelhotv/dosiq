import { getCurrentUser, logoutUser, getUserSettings, generateTelegramToken, completeOnboarding, captureDeviceTimezone, updateTimezone, hasFuturePendingDoses } from '../profileService'
import { supabase } from '../../../../platform/supabase/nativeSupabaseClient'
import { regenActiveProtocolsForTz, hasFuturePendingDoses as hasFuturePendingDosesCore } from '@dosiq/core'

// TODO(040-strict): jest.mock automock não preserva tipos — cast p/ acessar métodos de mock (nível B)
const mockedSupabase = supabase as any

// Mock supabase
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => {
  const maybeSingleMock = jest.fn()
  const eqMock = jest.fn(() => ({ maybeSingle: maybeSingleMock }))
  const selectMock = jest.fn(() => ({ eq: eqMock }))
  const upsertMock = jest.fn(() => Promise.resolve({ error: null }))
  const updateEqMock = jest.fn(() => Promise.resolve({ error: null }))
  const updateMock = jest.fn(() => ({ eq: updateEqMock }))
  const fromMock = jest.fn(() => ({ select: selectMock, upsert: upsertMock, update: updateMock }))
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

// F4.3f.2: regen/checker são do core — mantém o resto real (TIMEZONES_BR, resolveSupportedTz…).
jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  regenActiveProtocolsForTz: jest.fn(async () => ({ processed: 1, regenerated: 5, failed: 0 })),
  hasFuturePendingDoses: jest.fn(async () => true),
}))

describe('profileService', () => {
  const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = true
    
    // Default success mocks
    mockedSupabase.auth.getUser.mockResolvedValue({ 
      data: { user: { id: VALID_USER_ID, email: 'test@example.com' } }, 
      error: null 
    })
    mockedSupabase.auth.getSession.mockResolvedValue({
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
      mockedSupabase.auth.signOut.mockResolvedValue({ error: null })
      const res = await logoutUser()
      expect(res.success).toBe(true)
    })
  })

  describe('getUserSettings', () => {
    it('deve retornar settings do usuário', async () => {
      // Accessing chainable mock through mockedSupabase.from().select().eq()
      const mockMaybeSingle = mockedSupabase.from().select().eq().maybeSingle
      mockMaybeSingle.mockResolvedValue({ 
        data: { user_id: VALID_USER_ID, telegram_chat_id: 'chat123' }, 
        error: null 
      })

      const res = await getUserSettings()
      expect(res.error).toBeNull()
      expect(res.data.telegram_chat_id).toBe('chat123')
    })

    it('deve retornar objeto default se não houver settings', async () => {
      const mockMaybeSingle = mockedSupabase.from().select().eq().maybeSingle
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })
      
      const res = await getUserSettings()
      expect(res.error).toBeNull()
      expect(res.data.telegram_chat_id).toBeNull()
    })
  })

  describe('generateTelegramToken', () => {
    it('deve chamar rpc generate_telegram_token', async () => {
      mockedSupabase.rpc.mockResolvedValue({ data: 'TOKEN123', error: null })

      const res = await generateTelegramToken()
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('generate_telegram_token')
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
        resolvedOptions: () => ({ timeZone: 'Europe/London' } as any),
      } as any)
      const res = await completeOnboarding()
      expect(res.success).toBe(true)
      const upsertMock = mockedSupabase.from().upsert
      const row = upsertMock.mock.calls.at(-1)[0]
      expect(row).toMatchObject({ user_id: VALID_USER_ID, onboarding_completed: true, timezone: 'Europe/London' })
    })

    it('fuso do device não suportado → grava São Paulo', async () => {
      intlSpy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'Asia/Tokyo' } as any),
      } as any)
      await completeOnboarding()
      const row = mockedSupabase.from().upsert.mock.calls.at(-1)[0]
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
        resolvedOptions: () => ({ timeZone: 'America/New_York' } as any),
      } as any)
      const res = await captureDeviceTimezone()
      expect(res.success).toBe(true)
      const row = mockedSupabase.from().upsert.mock.calls.at(-1)[0]
      expect(row).toEqual({ user_id: VALID_USER_ID, timezone: 'America/New_York' })
    })
  })

  // F4.3f.2 — troca de fuso com intenção (viagem × mudança).
  describe('updateTimezone', () => {
    it('viagem (regen=false): só persiste o fuso, sem regenerar', async () => {
      const res = await updateTimezone('Europe/London')
      expect(res.success).toBe(true)
      const updateMock = mockedSupabase.from().update
      expect(updateMock).toHaveBeenCalledWith({ timezone: 'Europe/London' })
      expect(regenActiveProtocolsForTz).not.toHaveBeenCalled()
    })

    it('mudança (regen=true): persiste e re-ancora as doses no fuso novo', async () => {
      const res = await updateTimezone('Europe/London', { regen: true })
      expect(res.success).toBe(true)
      expect(regenActiveProtocolsForTz).toHaveBeenCalledWith(
        expect.objectContaining({ userId: VALID_USER_ID, tz: 'Europe/London' }),
      )
    })

    it('rejeita fuso fora da lista canônica', async () => {
      const res = await updateTimezone('Marte/Olympus')
      expect(res.success).toBe(false)
      expect(regenActiveProtocolsForTz).not.toHaveBeenCalled()
    })
  })

  describe('hasFuturePendingDoses', () => {
    it('delega ao core com o userId atual', async () => {
      (hasFuturePendingDosesCore as any).mockResolvedValueOnce(true)
      const out = await hasFuturePendingDoses()
      expect(out).toBe(true)
      expect(hasFuturePendingDosesCore).toHaveBeenCalledWith(supabase, VALID_USER_ID)
    })
  })
})
