// Spec 091 — PO-3 (allowlist intacta), PO-8 (guarda de dono), PO-SEC-2 (fail-closed), PO-SEC-3 (log).
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  wipeLocalUserData,
  ensureDeviceOwner,
  isDeviceKey,
  DEVICE_KEY_ALLOWLIST,
  DEVICE_OWNER_KEY,
  SESSION_ENDED_REASON_KEY,
} from '../localDataWipe'
import { PUSH_TOKEN_KEY } from '@platform/notifications/registerPushToken'
import { ALARM_PERMS_GUIDE_KEY } from '@platform/alarms/alarmEnabledStore'


const mocked = jest.mocked(AsyncStorage)
let store: Map<string, string>

function useMemoryStorage() {
  store = new Map()
  mocked.getAllKeys.mockImplementation(async () => [...store.keys()])
  mocked.getItem.mockImplementation(async (k: string) => (store.has(k) ? store.get(k)! : null))
  mocked.setItem.mockImplementation(async (k: string, v: string) => { store.set(k, v) })
  mocked.multiRemove.mockImplementation(async (keys: readonly string[]) => { keys.forEach((k) => store.delete(k)) })
}

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

// Chaves do aparelho que PRECISAM sobreviver, com o valor exato (PO-3).
const DEVICE_SEED: Record<string, string> = {
  '@dosiq/anvisa-manifest': '{"v":1}',
  '@dosiq/anvisa-data': '[{"n":"x"}]',
  'ota_update:last_check_at': '123',
  '@dosiq/alarm-perms-guide-shown': 'true',
  '@dosiq/expo-push-token': 'ExponentPushToken[abc]',
}

// Chaves por-pessoa, incluindo uma INVENTADA que nenhum código conhece (boundary da PO-1).
const PERSON_SEED: Record<string, string> = {
  mr_chat_history: '[{"role":"user","content":"minha dose de insulina"}]',
  '@dosiq/today-snapshot': '{"user":{"id":"a"}}',
  [`@dosiq/notif-last-seen:${USER_A}`]: '2026-09-27',
  'dosiq:stock-upsell-dismissed': '1',
  '@dosiq/audit/queue': '{"items":[{"event":"x"}]}',
  'chave-inventada-pelo-teste:qualquer': 'segredo-de-saude',
}

function seed(extra: Record<string, string> = {}) {
  for (const [k, v] of Object.entries({ ...DEVICE_SEED, ...PERSON_SEED, ...extra })) store.set(k, v)
}

describe('localDataWipe (spec 091)', () => {
  beforeEach(() => useMemoryStorage())
  afterEach(() => { jest.clearAllMocks(); jest.clearAllTimers() })

  it('PO-3: toda chave da allowlist segue presente e idêntica; toda chave por-pessoa some', async () => {
    seed()
    await wipeLocalUserData()
    for (const [k, v] of Object.entries(DEVICE_SEED)) expect(store.get(k)).toBe(v)
    for (const k of Object.keys(PERSON_SEED)) expect(store.has(k)).toBe(false)
  })

  it('PO-3 boundary: nunca usa AsyncStorage.clear() e a allowlist não é vazia', async () => {
    seed()
    await wipeLocalUserData()
    expect(mocked.clear).not.toHaveBeenCalled()
    expect(DEVICE_KEY_ALLOWLIST.length).toBeGreaterThan(0)
  })

  it('literais da allowlist batem com as constantes dos módulos donos', () => {
    expect(isDeviceKey(PUSH_TOKEN_KEY)).toBe(true)
    expect(isDeviceKey(ALARM_PERMS_GUIDE_KEY)).toBe(true)
    expect(isDeviceKey(DEVICE_OWNER_KEY)).toBe(true)
    expect(isDeviceKey(SESSION_ENDED_REASON_KEY)).toBe(true)
  })

  it('lista vazia não chama multiRemove; getAllKeys lançando não lança', async () => {
    await expect(wipeLocalUserData()).resolves.toEqual({ removed: 0 })
    expect(mocked.multiRemove).not.toHaveBeenCalled()
    mocked.getAllKeys.mockRejectedValueOnce(new Error('boom'))
    await expect(wipeLocalUserData()).resolves.toEqual({ removed: 0 })
  })

  describe('ensureDeviceOwner (PO-8 / AC-1.5)', () => {
    it('dono = A, cache de A regravado depois da saída, entra B ⇒ limpa e dono passa a B', async () => {
      seed({ [DEVICE_OWNER_KEY]: USER_A })
      const res = await ensureDeviceOwner(USER_B)
      expect(res.wiped).toBe(true)
      expect(store.has('mr_chat_history')).toBe(false)
      expect(store.has('@dosiq/today-snapshot')).toBe(false)
      expect(store.get(DEVICE_OWNER_KEY)).toBe(USER_B)
      expect(store.get('@dosiq/anvisa-data')).toBe(DEVICE_SEED['@dosiq/anvisa-data'])
    })

    it('boundary: entra A de novo com dono = A ⇒ nada apagado (offline do próprio titular)', async () => {
      seed({ [DEVICE_OWNER_KEY]: USER_A })
      const res = await ensureDeviceOwner(USER_A)
      expect(res.wiped).toBe(false)
      expect(mocked.multiRemove).not.toHaveBeenCalled()
      expect(store.get('@dosiq/today-snapshot')).toBe(PERSON_SEED['@dosiq/today-snapshot'])
    })

    it('sem dono gravado (instalação anterior à 091) ⇒ trata como outra pessoa', async () => {
      seed()
      const res = await ensureDeviceOwner(USER_A)
      expect(res.wiped).toBe(true)
      expect(store.has('mr_chat_history')).toBe(false)
    })

    it('userId vazio ⇒ no-op', async () => {
      seed()
      await expect(ensureDeviceOwner(null)).resolves.toEqual({ wiped: false })
      expect(store.has('mr_chat_history')).toBe(true)
    })

    it('PO-SEC-2: leitura do dono lançando ⇒ limpa mesmo assim (fail-closed no dado)', async () => {
      seed({ [DEVICE_OWNER_KEY]: USER_B })
      mocked.getItem.mockRejectedValueOnce(new Error('storage corrompido'))
      const res = await ensureDeviceOwner(USER_B)
      expect(res.wiped).toBe(true)
      expect(store.has('mr_chat_history')).toBe(false)
      expect(store.get(DEVICE_OWNER_KEY)).toBe(USER_B)
    })
  })

  it('PO-SEC-3: nada logado contém chave, valor ou id', async () => {
    const spies = [
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ]
    seed({ [DEVICE_OWNER_KEY]: USER_A })
    mocked.multiRemove.mockRejectedValueOnce(new Error(`falhou em @dosiq/notif-last-seen:${USER_A}`))
    await ensureDeviceOwner(USER_B)
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls))
    expect(logged).not.toContain(USER_A)
    expect(logged).not.toContain(USER_B)
    expect(logged).not.toContain('segredo-de-saude')
    spies.forEach((s) => s.mockRestore())
  })
})
