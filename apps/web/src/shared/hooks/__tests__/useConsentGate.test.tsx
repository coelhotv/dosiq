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

  // 096 B3 (C-B3-13): sem isto a conta legada consentia sem aceite dos Termos 0.4.
  it('grant do pedido grava A e o aceite dos Termos, nessa ordem', async () => {
    mockGetStatus.mockResolvedValue({ status: 'missing', policyVersion: null, updatedAt: null, stale: false })
    mockGrant.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    mockGrant.mockClear()

    await result.current.grant()

    expect(mockGrant.mock.calls.map((c) => c[0])).toEqual(['health_data', 'terms_privacy'])
  })

  it('A falhou ⇒ não tenta os Termos', async () => {
    mockGetStatus.mockResolvedValue({ status: 'missing', policyVersion: null, updatedAt: null, stale: false })
    mockGrant.mockResolvedValue({ ok: false, error: 'net' })

    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    mockGrant.mockClear()

    expect(await result.current.grant()).toEqual({ ok: false, error: 'net' })
    expect(mockGrant).toHaveBeenCalledTimes(1)
  })
})

describe('isConsentAllowedView — allowlist (R2/F8)', () => {
  it('rota de produto NÃO passa (Perfil incluso — dado de saúde); a saída da revogação e a conta passam', () => {
    expect(isConsentAllowedView('dashboard')).toBe(false)
    expect(isConsentAllowedView('treatment')).toBe(false)
    expect(isConsentAllowedView('profile')).toBe(false)
    expect(isConsentAllowedView('consent-resolution')).toBe(true)
    expect(isConsentAllowedView('account-settings')).toBe(true)
  })
})

describe('useConsentGate — grantV04 (RC6 #898)', () => {
  const stale = { status: 'granted', policyVersion: '0.3', updatedAt: '2026-07-01T12:00:00-03:00', stale: true }
  const current = { status: 'granted', policyVersion: '0.4', updatedAt: '2026-10-21T12:00:00-03:00', stale: false }

  it('🔴 falha ao gravar terms_privacy → ok:false (o reconsentimento não fecha)', async () => {
    mockGetStatus.mockResolvedValue(stale)
    mockGrant.mockImplementation(async (type: string) => (type === 'terms_privacy' ? { ok: false, error: 'net' } : { ok: true }))
    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    const res = await result.current.grantV04({ transfer: false })
    expect(res.ok).toBe(false)
  })

  it('nova tentativa com A já vigente na 0.4 → não regrava A (SC-001), só os termos', async () => {
    mockGetStatus.mockResolvedValue(current)
    mockGrant.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useConsentGate(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    mockGrant.mockClear()
    const res = await result.current.grantV04({ transfer: false })
    expect(res.ok).toBe(true)
    expect(mockGrant.mock.calls.map((c) => c[0])).toEqual(['terms_privacy'])
  })
})

