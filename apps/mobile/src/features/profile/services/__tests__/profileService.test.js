import { getCurrentUser, logoutUser, getUserSettings, generateTelegramToken } from '../profileService'
import { supabase } from '../../../../platform/supabase/nativeSupabaseClient'

// Mock supabase (with chaining support)
const maybeSingleMock = jest.fn()
const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
const selectMock = jest.fn().mockReturnValue({ eq: eqMock })
const fromMock = jest.fn().mockReturnValue({ select: selectMock })

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
    from: fromMock,
    rpc: jest.fn(),
  },
}))

describe('profileService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.__DEV__ = true
    
    // Default success for getUser (needed for getUserSettings internal call)
    supabase.auth.getUser.mockResolvedValue({ 
      data: { user: { id: '123', email: 'test@example.com' } }, 
      error: null 
    })
  })

  describe('getCurrentUser', () => {
    it('deve retornar dados do usuário com sucesso', async () => {
      const res = await getCurrentUser()
      expect(res.data.id).toBe('123')
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
      maybeSingleMock.mockResolvedValue({ 
        data: { user_id: '123', telegram_chat_id: 'chat123' }, 
        error: null 
      })

      const res = await getUserSettings()
      expect(res.error).toBeNull()
      expect(res.data.telegram_chat_id).toBe('chat123')
    })

    it('deve retornar objeto default se não houver settings', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null })
      
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
