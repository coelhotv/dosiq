// useConsentSuppressed.test.tsx — supressão local das superfícies de saúde sob revogação (spec 046).
//
// Contrato LGPD (art. 11): com o consentimento REVOGADO, os bridges (alarme, dose activity, Live
// Activity) devem desarmar — processar dose com nome/dosagem no aparelho sem base legal é violação.
// Aqui: 'revoked' → suprime; 'granted'/'missing' → não; falha de leitura → mantém (fail-open
// consciente, não some com alarme clínico por um piscar de rede); e o bus re-checa após revoke in-app.
import { renderHook, act, waitFor } from '@testing-library/react-native'

jest.mock('@dosiq/core', () => {
  const getStatus = jest.fn()
  return { __esModule: true, createConsentService: () => ({ getStatus }), __getStatus: getStatus }
})
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

const { __getStatus: mockGetStatus } = jest.requireMock('@dosiq/core') as { __getStatus: jest.Mock }
import { useConsentSuppressed } from '../useConsentSuppressed'
import { triggerConsentChange } from '../consentSuppressionBus'

afterEach(() => {
  jest.clearAllMocks()
})

describe('useConsentSuppressed', () => {
  it('revoked → suprime', async () => {
    mockGetStatus.mockResolvedValue({ status: 'revoked' })
    const { result } = renderHook(() => useConsentSuppressed('user-1'))
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('granted → não suprime', async () => {
    mockGetStatus.mockResolvedValue({ status: 'granted' })
    const { result } = renderHook(() => useConsentSuppressed('user-1'))
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalled())
    expect(result.current).toBe(false)
  })

  it('missing → não suprime (nunca consentiu ≠ revogado)', async () => {
    mockGetStatus.mockResolvedValue({ status: 'missing' })
    const { result } = renderHook(() => useConsentSuppressed('user-1'))
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalled())
    expect(result.current).toBe(false)
  })

  it('sem usuário → não suprime e não lê a trilha', async () => {
    const { result } = renderHook(() => useConsentSuppressed(null))
    await waitFor(() => expect(result.current).toBe(false))
    expect(mockGetStatus).not.toHaveBeenCalled()
  })

  it('falha de leitura mantém o valor anterior (fail-open consciente)', async () => {
    mockGetStatus.mockResolvedValueOnce({ status: 'revoked' })
    const { result } = renderHook(() => useConsentSuppressed('user-1'))
    await waitFor(() => expect(result.current).toBe(true))

    // Próxima leitura falha (rede piscou) → NÃO volta a liberar as superfícies.
    mockGetStatus.mockRejectedValueOnce(new Error('network'))
    await act(async () => { triggerConsentChange() })
    expect(result.current).toBe(true)
  })

  it('bus de consentimento re-checa após revoke in-app (sem foreground)', async () => {
    mockGetStatus.mockResolvedValueOnce({ status: 'granted' })
    const { result } = renderHook(() => useConsentSuppressed('user-1'))
    await waitFor(() => expect(result.current).toBe(false))

    mockGetStatus.mockResolvedValueOnce({ status: 'revoked' })
    await act(async () => { triggerConsentChange() })
    await waitFor(() => expect(result.current).toBe(true))
  })
})
