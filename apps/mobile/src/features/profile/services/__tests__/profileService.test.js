import { getCurrentUser, logoutUser, getUserSettings, generateTelegramToken } from '../profileService'
import { supabase } from '../../../../platform/supabase/nativeSupabaseClient'

// Mock supabase
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => {
  const maybeSingleMock = jest.fn()
  const eqMock = jest.fn(() => ({ maybeSingle: maybeSingleMock }))
  const selectMock = jest.fn(() => ({ eq: eqMock }))
  const fromMock = jest.fn(() => ({ select: selectMock }))
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
})
