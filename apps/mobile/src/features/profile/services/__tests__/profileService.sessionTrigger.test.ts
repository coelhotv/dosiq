// Spec 091 — PO-5, 4º gatilho: o Perfil pergunta ao SERVIDOR pelo usuário (`getUser`). Conta
// inexistente encerra a sessão pelo ponto único; erro de rede só vira mensagem, nunca logout.
import { getProfile } from '../profileService'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { endSession } from '@platform/session/endSession'
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn(), getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}))
jest.mock('@platform/session/endSession', () => ({
  endSession: jest.fn(() => Promise.resolve({ success: true, auditDiscarded: 0 })),
}))
jest.mock('@platform/analytics/productAnalytics', () => ({ logEvent: jest.fn(), resetUser: jest.fn() }))

const getUser = jest.mocked(supabase.auth.getUser)

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

it('getUser sem usuário (conta excluída) ⇒ endSession("invalid") e erro na tela', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found') })
  const res = await getProfile()
  expect(res.data).toBeNull()
  expect(endSession).toHaveBeenCalledWith('invalid')
})

it('boundary: erro de rede NÃO encerra a sessão', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('Network request failed', 0) })
  await getProfile()
  expect(endSession).not.toHaveBeenCalled()
})
