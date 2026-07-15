// useConsentGate.test.tsx — spec 046 T009 / PO-2.
//
// 🔴 O TESTE QUE IMPORTA: `getStatus()` LANÇA em falha de leitura, e o guard tem que tratar isso
// como INDETERMINADO — nunca como `missing`. Se cair no ramo do `missing`, o app conta uma sessão de
// prompt e a materialização RESSUSCITA um consentimento REVOGADO numa oscilação de rede. Foi o furo
// HIGH pego no review do Slice A (família AP-290).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// vi.mock é içado acima das consts — os mocks precisam nascer no mesmo içamento.
const { mockGetStatus, mockGrant, mockMaterialize, mockBump } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
  mockGrant: vi.fn(),
  mockMaterialize: vi.fn(),
  mockBump: vi.fn(),
}))

vi.mock('@shared/utils/supabase', () => ({
  supabase: {},
  getUserId: vi.fn(async () => 'user-1'),
}))

vi.mock('@dosiq/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dosiq/core')>()
  return {
    ...actual,
    createConsentService: () => ({
      getStatus: mockGetStatus,
      grant: mockGrant,
      revoke: vi.fn(),
      materializeSignupIntent: mockMaterialize,
    }),
    createProfileRepository: () => ({
      bumpConsentPromptSession: mockBump,
    }),
  }
})

import { ConsentGateProvider, useConsentGate, isConsentAllowedView } from '../useConsentGate'

const SESSION = { user_metadata: { health_consent: true, policy_version: '0.3' } }

function wrapper({ children }: { children: React.ReactNode }) {
  return <ConsentGateProvider session={SESSION}>{children}</ConsentGateProvider>
}

beforeEach(() => {
  mockMaterialize.mockResolvedValue({ materialized: false })
  mockBump.mockResolvedValue({ sessions: 1, counted: true })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('useConsentGate — falha de leitura da trilha (PO-2)', () => {
  it('🔴 getStatus que LANÇA → indeterminate: não libera, não bloqueia', async () => {
    mockGetStatus.mockRejectedValue(new Error('Falha ao ler a trilha de consentimento: network'))

    const { result } = renderHook(() => useConsentGate(), { wrapper })

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.mode).toBe('indeterminate')
    expect(result.current.locked).toBe(false)
    expect(result.current.state).toBeNull()
  })

  it('🔴 sob exceção NÃO conta sessão de prompt — a cortesia do titular não queima por erro de infra', async () => {
    mockGetStatus.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(mockBump).not.toHaveBeenCalled()
  })

  it('🔴 sob exceção NÃO escreve nada na trilha (nada de grant especulativo)', async () => {
    mockGetStatus.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(mockGrant).not.toHaveBeenCalled()
  })
})

describe('useConsentGate — estados lidos com sucesso', () => {
  it('granted → allow', async () => {
    mockGetStatus.mockResolvedValue({ status: 'granted', policyVersion: '0.3', updatedAt: '2026-07-01T10:00:00Z', stale: false })

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.mode).toBe('allow')
    expect(mockBump).not.toHaveBeenCalled()
  })

  it('revoked → trava (e não conta sessão: sessão é do prompt de quem nunca se manifestou)', async () => {
    mockGetStatus.mockResolvedValue({ status: 'revoked', policyVersion: '0.3', updatedAt: '2026-07-10T10:00:00Z', stale: false })

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.mode).toBe('blocked_revoked')
    expect(result.current.locked).toBe(true)
    expect(mockBump).not.toHaveBeenCalled()
  })

  it('missing → conta a sessão e mostra prompt dispensável', async () => {
    mockGetStatus.mockResolvedValue({ status: 'missing', policyVersion: null, updatedAt: null, stale: false })
    mockBump.mockResolvedValue({ sessions: 1, counted: true })

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(mockBump).toHaveBeenCalledTimes(1)
    expect(result.current.mode).toBe('prompt_dismissible')
  })

  it('missing com a cortesia esgotada → prompt bloqueante', async () => {
    mockGetStatus.mockResolvedValue({ status: 'missing', policyVersion: null, updatedAt: null, stale: false })
    mockBump.mockResolvedValue({ sessions: 4, counted: true })

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.mode).toBe('prompt_blocking')
    expect(result.current.locked).toBe(true)
  })

  it('grant chama o RPC via consentService (nunca insert)', async () => {
    mockGetStatus.mockResolvedValue({ status: 'missing', policyVersion: null, updatedAt: null, stale: false })
    mockGrant.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    await result.current.grant()

    expect(mockGrant).toHaveBeenCalledWith('health_data', 'web')
  })
})

describe('isConsentAllowedView — allowlist (R2/F8)', () => {
  it('rota de produto NÃO passa; a saída da revogação e o export passam', () => {
    expect(isConsentAllowedView('dashboard')).toBe(false)
    expect(isConsentAllowedView('treatment')).toBe(false)
    expect(isConsentAllowedView('consent-resolution')).toBe(true)
    expect(isConsentAllowedView('profile')).toBe(true)
  })
})
