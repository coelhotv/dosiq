// Spec 091 — PO-1 (AC-1.1 + AC-1.2): troca de conta A→B no MESMO aparelho, por cada caminho de
// saída. Semeia chaves por-pessoa (inclusive o histórico do assistente e uma chave INVENTADA que
// nenhum código conhece) e prova, pelo fluxo real do chat (`loadHistory` → `sendChatMessage`), que
// nada de A chega ao corpo enviado ao `/api/chatbot` na sessão de B.
//
// Boundary: a limpeza não enumera o que o teste semeia — a chave inventada só some se a regra for
// "tudo fora da allowlist".
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { logoutUser } from '@features/profile/services/profileService'
import { signOut as authSignOut } from '@platform/auth/authService'
import { endSession, handleExternalSignOut } from '../endSession'
import { ensureDeviceOwner, DEVICE_OWNER_KEY } from '../localDataWipe'
import { loadHistory } from '@features/chatbot/services/chatHistoryStore'
import { sendChatMessage } from '@features/chatbot/services/chatbotService'

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getSession: jest.fn(), signOut: jest.fn(), getUser: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}))
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: jest.fn(() => Promise.resolve()),
  resetUser: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(),
}))
jest.mock('@platform/alarms/outOfWindowNotice', () => ({ ALARM_OUT_OF_WINDOW_EVENT: 'alarm_out_of_window' }))

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const A_SECRET = 'A tomou 2 comprimidos de sertralina'

const mockedStorage = jest.mocked(AsyncStorage)
const auth = supabase.auth as unknown as { getSession: jest.Mock; signOut: jest.Mock }
let store: Map<string, string>

function seedAccountA() {
  store.set(DEVICE_OWNER_KEY, USER_A)
  store.set('mr_chat_history', JSON.stringify([
    { role: 'user', content: A_SECRET },
    { role: 'assistant', content: 'Anotado.' },
  ]))
  store.set('@dosiq/today-snapshot', JSON.stringify({ user: { id: USER_A }, protocols: [{ id: 'pA' }] }))
  store.set('@dosiq/stock-tracking-pref', '{"enabled":true}')
  store.set(`@dosiq/notif-last-seen:${USER_A}`, '2026-09-27')
  store.set('nudges_cache:today', '[]')
  store.set('dosiq:evo-switch-dismissed:pA', '1')
  store.set('feature-futura-que-ninguem-listou', A_SECRET)
  // Do aparelho: tem de sobreviver.
  store.set('@dosiq/anvisa-data', '[1]')
  store.set('ota_update:last_check_at', '42')
}

function sessionOf(userId: string) {
  return { data: { session: { user: { id: userId }, access_token: `tok-${userId}` } }, error: null }
}

async function bodySentByB(): Promise<string> {
  auth.getSession.mockResolvedValue(sessionOf(USER_B))
  const history = await loadHistory()
  await sendChatMessage({ message: 'oi', history, patientContext: 'ctx de B' })
  return (global.fetch as jest.Mock).mock.calls[0][1].body
}

beforeEach(() => {
  store = new Map()
  mockedStorage.getAllKeys.mockImplementation(async () => [...store.keys()])
  mockedStorage.getItem.mockImplementation(async (k: string) => (store.has(k) ? store.get(k)! : null))
  mockedStorage.setItem.mockImplementation(async (k: string, v: string) => { store.set(k, v) })
  mockedStorage.removeItem.mockImplementation(async (k: string) => { store.delete(k) })
  mockedStorage.multiRemove.mockImplementation(async (keys: readonly string[]) => { keys.forEach((k) => store.delete(k)) })
  auth.getSession.mockResolvedValue(sessionOf(USER_A))
  auth.signOut.mockResolvedValue({ error: null })
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ response: 'ok' }) })) as any
  seedAccountA()
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

function expectOnlyDeviceKeysLeft() {
  expect([...store.keys()].sort()).toEqual(
    expect.arrayContaining(['@dosiq/anvisa-data', 'ota_update:last_check_at']),
  )
  for (const k of store.keys()) {
    expect(['@dosiq/anvisa-data', 'ota_update:last_check_at', DEVICE_OWNER_KEY, '@dosiq/session-ended-reason']).toContain(k)
  }
}

it.each([
  ['logout (Perfil → profileService.logoutUser)', () => logoutUser()],
  ['logout (authService.signOut)', () => authSignOut()],
  ['exclusão de conta', () => endSession('deleted')],
  ['sessão derrubada pelo auth-js (SIGNED_OUT não pedido)', () => handleExternalSignOut()],
  ['sessão inválida (conta excluída em outro aparelho)', () => endSession('invalid')],
])('%s ⇒ nada de A sobra no aparelho nem vai ao LLM na sessão de B', async (_label, exit) => {
  await exit()

  expectOnlyDeviceKeysLeft()
  const body = await bodySentByB()
  expect(body).not.toContain(A_SECRET)
  expect(JSON.parse(body).history).toEqual([])
})

it('rede de segurança na entrada: saída interrompida, B entra ⇒ guarda de dono limpa antes de B ler', async () => {
  // Nenhum caminho de saída rodou (app morto no meio, versão antiga, etc.).
  await ensureDeviceOwner(USER_B)
  expectOnlyDeviceKeysLeft()
  expect(store.get(DEVICE_OWNER_KEY)).toBe(USER_B)
  const body = await bodySentByB()
  expect(body).not.toContain(A_SECRET)
})
