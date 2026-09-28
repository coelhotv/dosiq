// Spec 091 — PO-4/INV-3 (registro só com conta confirmada no servidor) e PO-SEC-1 (token guardado
// para a saída desativar a linha `apns_liveactivity`).
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { syncNotificationDevice } from '@platform/notifications/syncNotificationDevice'
import { getPushToStartToken } from '../liveActivityService'
import { registerPushToStart, resetPushToStartDedupe } from '../pushToStartRegistration'
import { LIVE_ACTIVITY_PUSH_TOKEN_KEY } from '@platform/session/localDataWipe'

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: { getUser: jest.fn() } } }))
jest.mock('@platform/notifications/syncNotificationDevice', () => ({ syncNotificationDevice: jest.fn(() => Promise.resolve()) }))
jest.mock('../liveActivityService', () => ({ getPushToStartToken: jest.fn() }))

const getUser = supabase.auth.getUser as unknown as jest.Mock
const USER = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'e4ff37a4'

beforeEach(() => {
  resetPushToStartDedupe()
  jest.mocked(getPushToStartToken).mockResolvedValue(TOKEN)
  getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null })
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

it('conta confirmada ⇒ registra apns_liveactivity e guarda o token para a saída', async () => {
  await registerPushToStart(USER)
  expect(syncNotificationDevice).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, token: TOKEN, provider: 'apns_liveactivity' }))
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(LIVE_ACTIVITY_PUSH_TOKEN_KEY, TOKEN)
})

it('conta excluída (getUser 403) ⇒ não registra', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: Object.assign(new Error('x'), { status: 403, code: 'user_not_found' }) })
  await registerPushToStart(USER)
  expect(syncNotificationDevice).not.toHaveBeenCalled()
})

it('sem rede na confirmação ⇒ não registra (nunca escreve no escuro)', async () => {
  getUser.mockRejectedValue(new Error('Network request failed'))
  await registerPushToStart(USER)
  expect(syncNotificationDevice).not.toHaveBeenCalled()
})

it('dedupe: mesmo par não re-registra; depois do reset do logout, a mesma pessoa re-registra', async () => {
  await registerPushToStart(USER)
  await registerPushToStart(USER)
  expect(syncNotificationDevice).toHaveBeenCalledTimes(1)
  resetPushToStartDedupe()
  await registerPushToStart(USER)
  expect(syncNotificationDevice).toHaveBeenCalledTimes(2)
})
