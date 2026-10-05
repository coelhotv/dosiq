// Spec 091 — PO-2 (fila de auditoria na saída), PO-SEC-1 (aparelho desativado com a sessão de quem
// sai), PO-4 parcial (encerramento de sessão inválida), PO-SEC-3 (log sem id).
// Fila REAL (createCriticalAuditQueue) e serviço de auditoria REAL do core; só o client do Supabase
// e o AsyncStorage são falsos (boundary da PO-2: não vale mockar a fila).
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { logEvent, resetUser } from '@platform/analytics/productAnalytics'
import { endSession, drainAuditQueue, handleExternalSignOut, isEndingSession } from '../endSession'
import { SESSION_ENDED_REASON_KEY } from '../localDataWipe'

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getSession: jest.fn(), signOut: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}))
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: jest.fn(() => Promise.resolve()),
  resetUser: jest.fn(() => Promise.resolve()),
}))
jest.mock('@platform/alarms/outOfWindowNotice', () => ({ ALARM_OUT_OF_WINDOW_EVENT: 'alarm_out_of_window' }))

const USER_A = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'ExponentPushToken[device]'
const mockedStorage = jest.mocked(AsyncStorage)
const auth = supabase.auth as unknown as { getSession: jest.Mock; signOut: jest.Mock }
const from = supabase.from as unknown as jest.Mock
const rpc = (supabase as any).rpc as jest.Mock

let store: Map<string, string>
let auditInsert: jest.Mock
let deviceUpdate: jest.Mock
let deviceFilters: Array<[string, unknown]>

function auditItem(event = 'alarm_fired') {
  return {
    userId: USER_A,
    doseInstanceId: '33333333-3333-4333-8333-333333333333',
    event,
    platform: 'android',
    actor: 'system',
  }
}

function seedQueue(items: object[]) {
  store.set('@dosiq/audit/queue', JSON.stringify({ items, overflowDropped: 0 }))
}

beforeEach(() => {
  store = new Map()
  mockedStorage.getAllKeys.mockImplementation(async () => [...store.keys()])
  mockedStorage.getItem.mockImplementation(async (k: string) => (store.has(k) ? store.get(k)! : null))
  mockedStorage.setItem.mockImplementation(async (k: string, v: string) => { store.set(k, v) })
  mockedStorage.removeItem.mockImplementation(async (k: string) => { store.delete(k) })
  mockedStorage.multiRemove.mockImplementation(async (keys: readonly string[]) => { keys.forEach((k) => store.delete(k)) })

  store.set('@dosiq/expo-push-token', TOKEN)
  store.set('mr_chat_history', '[{"content":"dado de A"}]')
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: USER_A } } }, error: null })
  auth.signOut.mockResolvedValue({ error: null })

  rpc.mockResolvedValue({ error: null })
  auditInsert = jest.fn(() => Promise.resolve({ error: null }))
  deviceFilters = []
  const chain: any = {
    eq: jest.fn((col: string, val: unknown) => {
      deviceFilters.push([col, val])
      return deviceFilters.length % 3 === 0 ? Promise.resolve({ error: null }) : chain
    }),
  }
  deviceUpdate = jest.fn(() => chain)
  from.mockImplementation((table: string) =>
    table === 'dose_critical_events' ? { insert: auditInsert } : { update: deviceUpdate },
  )
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('endSession — ordem e limpeza (spec 091)', () => {
  it('logout: auditoria → desativa aparelho → logout → signOut → wipe → resetUser', async () => {
    seedQueue([auditItem()])
    const res = await endSession('logout')

    expect(res).toEqual({ success: true, auditDiscarded: 0 })
    const order = (m: jest.Mock) => m.mock.invocationCallOrder[0]
    expect(order(auditInsert)).toBeLessThan(order(deviceUpdate))
    expect(order(deviceUpdate)).toBeLessThan(order(auth.signOut))
    expect(order(logEvent as jest.Mock)).toBeLessThan(order(auth.signOut))
    expect(order(auth.signOut)).toBeLessThan(order(mockedStorage.multiRemove))
    expect(order(mockedStorage.multiRemove)).toBeLessThan(order(resetUser as jest.Mock))
    expect(store.has('mr_chat_history')).toBe(false)
    expect(store.has('@dosiq/audit/queue')).toBe(false)
  })

  it('PO-SEC-1: aparelho desativado com user_id de quem sai e is_active=false', async () => {
    await endSession('logout')
    expect(from).toHaveBeenCalledWith('notification_devices')
    expect(deviceUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }))
    expect(deviceFilters).toEqual(expect.arrayContaining([['user_id', USER_A], ['push_token', TOKEN]]))
  })

  it('PO-SEC-1: iOS — desativa também o token push-to-start do Live Activity (smoke 28/09)', async () => {
    store.set('@dosiq/liveactivity-push-token', 'e4ff37a4')
    await endSession('logout')
    expect(deviceUpdate).toHaveBeenCalledTimes(2)
    expect(deviceFilters).toEqual(expect.arrayContaining([
      ['provider', 'expo'], ['push_token', TOKEN],
      ['provider', 'apns_liveactivity'], ['push_token', 'e4ff37a4'],
    ]))
  })

  it('PO-SEC-1: invalid também desativa; deleted NÃO (linhas somem em cascata)', async () => {
    await endSession('invalid')
    expect(deviceUpdate).toHaveBeenCalledTimes(1)
    deviceUpdate.mockClear()
    await endSession('deleted')
    expect(deviceUpdate).not.toHaveBeenCalled()
  })

  it('PO-SEC-1: desativação falhando não impede a saída', async () => {
    deviceUpdate.mockImplementation(() => { throw new Error('Network request failed') })
    const res = await endSession('logout')
    expect(res.success).toBe(true)
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('PO-2: flush falhando ⇒ itens descartados e contados, fila vazia, nenhum insert depois do signOut', async () => {
    seedQueue([auditItem(), auditItem('alarm_scheduled')])
    auditInsert.mockResolvedValue({ error: { message: 'Network request failed' } })

    const res = await endSession('logout')

    expect(res.auditDiscarded).toBe(2)
    expect(store.has('@dosiq/audit/queue')).toBe(false)
    const signOutAt = auth.signOut.mock.invocationCallOrder[0]
    auditInsert.mock.invocationCallOrder.forEach((at) => expect(at).toBeLessThan(signOutAt))
  })

  it('anomalia de janela sem consentimento conhecido é descartada, nunca gravada (G-5)', async () => {
    seedQueue([auditItem('alarm_out_of_window')])
    const { remaining } = await drainAuditQueue()
    expect(remaining).toBe(0)
    expect(auditInsert).not.toHaveBeenCalled()
  })

  it('deleted: não drena de novo (o chamador drenou antes do RPC) e conta o que sobrou', async () => {
    seedQueue([auditItem()])
    const res = await endSession('deleted')
    expect(auditInsert).not.toHaveBeenCalled()
    expect(res.auditDiscarded).toBe(1)
    expect(logEvent).not.toHaveBeenCalled()
    expect(store.has('@dosiq/audit/queue')).toBe(false)
  })

  it('invalid: grava a marca de UI ANTES do signOut (a Landing monta de dentro dele)', async () => {
    await endSession('invalid')
    expect(store.get(SESSION_ENDED_REASON_KEY)).toBe('invalid')
    const markAt = mockedStorage.setItem.mock.invocationCallOrder[
      mockedStorage.setItem.mock.calls.findIndex(([k]) => k === SESSION_ENDED_REASON_KEY)
    ]
    expect(markAt).toBeLessThan(auth.signOut.mock.invocationCallOrder[0])
    expect(logEvent).not.toHaveBeenCalled()
  })

  it('logout com signOut falhando de verdade ⇒ sessão segue, dados ficam (INV-2)', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'Logout failed' } })
    const res = await endSession('logout')
    expect(res.success).toBe(false)
    expect(store.has('mr_chat_history')).toBe(true)
    expect(mockedStorage.multiRemove).not.toHaveBeenCalled()
  })

  it('logout com "session missing" ⇒ conta como saída e LIMPA (E-2)', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'Auth session missing!', name: 'AuthSessionMissingError' } })
    const res = await endSession('logout')
    expect(res.success).toBe(true)
    expect(store.has('mr_chat_history')).toBe(false)
  })

  it('chamadas concorrentes compartilham UMA execução', async () => {
    const [a, b] = await Promise.all([endSession('logout'), endSession('invalid')])
    expect(a).toBe(b)
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(isEndingSession()).toBe(false)
  })
})

describe('handleExternalSignOut (SIGNED_OUT que ninguém pediu)', () => {
  it('refresh negado / session_not_found ⇒ marca + wipe + resetUser', async () => {
    await handleExternalSignOut()
    expect(store.get(SESSION_ENDED_REASON_KEY)).toBe('invalid')
    expect(store.has('mr_chat_history')).toBe(false)
    expect(resetUser).toHaveBeenCalled()
  })

  it('durante um endSession é no-op (o listener dispara de dentro do signOut)', async () => {
    let inner: Promise<void> | null = null
    auth.signOut.mockImplementation(async () => {
      inner = handleExternalSignOut()
      return { error: null }
    })
    await endSession('logout')
    await inner
    expect(store.has(SESSION_ENDED_REASON_KEY)).toBe(false)
  })
})

it('PO-SEC-3: saída não loga id, token nem conteúdo', async () => {
  const spies = [
    jest.spyOn(console, 'warn').mockImplementation(() => {}),
    jest.spyOn(console, 'log').mockImplementation(() => {}),
    jest.spyOn(console, 'error').mockImplementation(() => {}),
  ]
  seedQueue([auditItem()])
  auditInsert.mockResolvedValue({ error: { message: 'offline' } })
  await endSession('logout')
  const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls))
  expect(logged).not.toContain(USER_A)
  expect(logged).not.toContain(TOKEN)
  expect(logged).not.toContain('dado de A')
  spies.forEach((s) => s.mockRestore())
})

// Spec 095 — PO-4: a saída apaga a linha de atividade desta instalação, antes do signOut, sem bloquear.
describe('endSession — atividade da instalação (spec 095)', () => {
  const INSTALL_ID = '22222222-2222-4222-8222-222222222222'

  it('logout: apaga a linha da instalação com a sessão de quem sai, antes do signOut', async () => {
    store.set('@dosiq/install-id', INSTALL_ID)
    await endSession('logout')
    expect(rpc).toHaveBeenCalledWith('delete_device_activity', { p_install_id: INSTALL_ID })
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(auth.signOut.mock.invocationCallOrder[0])
    // o id gira: o wipe o apaga (FR-011)
    expect(store.has('@dosiq/install-id')).toBe(false)
  })

  it('falha de rede ao apagar não bloqueia a saída', async () => {
    store.set('@dosiq/install-id', INSTALL_ID)
    rpc.mockRejectedValueOnce(new Error('network'))
    const res = await endSession('logout')
    expect(res.success).toBe(true)
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('deleted: não chama (a conta some em cascata)', async () => {
    store.set('@dosiq/install-id', INSTALL_ID)
    await endSession('deleted')
    expect(rpc).not.toHaveBeenCalledWith('delete_device_activity', expect.anything())
  })
})
