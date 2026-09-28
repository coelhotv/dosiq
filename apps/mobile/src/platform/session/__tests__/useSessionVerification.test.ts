// Spec 091 — PO-5 (gatilhos da sessão inválida; rede nunca encerra) e PO-4 (boot com conta
// inexistente encerra). Os erros abaixo reproduzem as CLASSES que o auth-js 2.91.0 lança
// (`lib/fetch.js` handleError): AuthApiError(status, code), AuthSessionMissingError,
// AuthRetryableFetchError(status 0 | 502-504).
import { AppState } from 'react-native'
import { renderHook, waitFor, act } from '@testing-library/react-native'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { endSession } from '../endSession'
import { classifyAuthUserResult, verifyCurrentSession, useSessionVerification, VERIFY_TIMEOUT_MS } from '../useSessionVerification'

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: { getUser: jest.fn() } } }))
jest.mock('../endSession', () => ({ endSession: jest.fn(() => Promise.resolve({ success: true, auditDiscarded: 0 })) }))

const getUser = supabase.auth.getUser as unknown as jest.Mock
const mockedEnd = jest.mocked(endSession)

function authErr(name: string, status: number, code?: string, message = 'x') {
  return Object.assign(new Error(message), { name, status, code })
}

const USER = { id: '11111111-1111-4111-8111-111111111111' }
const DELETED = { data: { user: null }, error: authErr('AuthApiError', 403, 'user_not_found', 'User from sub claim in JWT does not exist') }
const OFFLINE = { data: { user: null }, error: authErr('AuthRetryableFetchError', 0, undefined, 'Network request failed') }

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('classifyAuthUserResult', () => {
  it.each([
    ['usuário devolvido', { data: { user: USER }, error: null }, 'confirmed'],
    ['conta excluída (403 user_not_found)', DELETED, 'invalid'],
    ['sessão apagada (AuthSessionMissingError)', { data: { user: null }, error: authErr('AuthSessionMissingError', 400) }, 'invalid'],
    ['JWT ruim (401)', { data: { user: null }, error: authErr('AuthApiError', 401, 'bad_jwt') }, 'invalid'],
    ['sem usuário e sem erro', { data: { user: null }, error: null }, 'invalid'],
    ['sem rede (retryable, status 0)', OFFLINE, 'unknown'],
    ['gateway (503)', { data: { user: null }, error: authErr('AuthRetryableFetchError', 503) }, 'unknown'],
    ['erro 500 genérico', { data: { user: null }, error: authErr('AuthApiError', 500, 'unexpected_failure') }, 'unknown'],
    ['erro sem forma conhecida', { data: { user: null }, error: new Error('TypeError: Network request failed') }, 'unknown'],
  ])('%s ⇒ %s', (_label, result, expected) => {
    expect(classifyAuthUserResult(result as any)).toBe(expected)
  })
})

describe('verifyCurrentSession', () => {
  it('PO-4: conta inexistente no servidor ⇒ endSession("invalid")', async () => {
    getUser.mockResolvedValue(DELETED)
    await expect(verifyCurrentSession()).resolves.toBe('invalid')
    expect(mockedEnd).toHaveBeenCalledWith('invalid')
  })

  it('PO-5 boundary: sem rede NÃO encerra', async () => {
    getUser.mockResolvedValue(OFFLINE)
    await expect(verifyCurrentSession()).resolves.toBe('unknown')
    expect(mockedEnd).not.toHaveBeenCalled()
  })

  it('getUser pendurado (rede ruim) ⇒ unknown no teto, não encerra, boot não trava', async () => {
    jest.useFakeTimers()
    getUser.mockReturnValue(new Promise(() => {}))
    const pending = verifyCurrentSession()
    jest.advanceTimersByTime(VERIFY_TIMEOUT_MS)
    await expect(pending).resolves.toBe('unknown')
    expect(mockedEnd).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('getUser lançando ⇒ unknown, não encerra', async () => {
    getUser.mockRejectedValue(new Error('boom'))
    await expect(verifyCurrentSession()).resolves.toBe('unknown')
    expect(mockedEnd).not.toHaveBeenCalled()
  })
})

describe('useSessionVerification — gatilhos boot e foreground (PO-5)', () => {
  let appStateHandler: ((s: string) => void) | null = null
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_evt, handler: any) => {
      appStateHandler = handler
      return { remove: jest.fn() } as any
    })
  })

  it('boot: começa em checking e vira confirmed', async () => {
    getUser.mockResolvedValue({ data: { user: USER }, error: null })
    const { result } = renderHook(() => useSessionVerification(USER.id))
    expect(result.current).toBe('checking')
    await waitFor(() => expect(result.current).toBe('confirmed'))
  })

  it('foreground: conta excluída enquanto o app estava em background ⇒ encerra', async () => {
    getUser.mockResolvedValue({ data: { user: USER }, error: null })
    const { result } = renderHook(() => useSessionVerification(USER.id))
    await waitFor(() => expect(result.current).toBe('confirmed'))

    getUser.mockResolvedValue(DELETED)
    await act(async () => { appStateHandler?.('active') })
    await waitFor(() => expect(result.current).toBe('invalid'))
    expect(mockedEnd).toHaveBeenCalledWith('invalid')
  })

  it('foreground sem rede ⇒ unknown (escrita automática trava), sessão fica', async () => {
    getUser.mockResolvedValue({ data: { user: USER }, error: null })
    const { result } = renderHook(() => useSessionVerification(USER.id))
    await waitFor(() => expect(result.current).toBe('confirmed'))

    getUser.mockResolvedValue(OFFLINE)
    await act(async () => { appStateHandler?.('active') })
    await waitFor(() => expect(result.current).toBe('unknown'))
    expect(mockedEnd).not.toHaveBeenCalled()
  })

  it('sem sessão ⇒ none, nem pergunta ao servidor', () => {
    const { result } = renderHook(() => useSessionVerification(null))
    expect(result.current).toBe('none')
    expect(getUser).not.toHaveBeenCalled()
  })
})
