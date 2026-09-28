// Spec 091 — PO-4 / INV-3: nenhuma escrita automática em nome da pessoa antes de o servidor
// confirmar que a conta existe. Serviços REAIS do core; só o client do Supabase é falso — a prova é
// "o RPC `consent_grant` não saiu", não "uma função mockada não foi chamada".
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { ConsentGateProvider, useConsentGate } from '../useConsentGate'

jest.mock('@platform/supabase/nativeSupabaseClient', () => {
  // Trilha vazia ⇒ status `missing` ⇒ é exatamente o caso em que a materialização GRAVARIA.
  const chain: any = {}
  ;['select', 'eq', 'order', 'limit', 'update', 'maybeSingle', 'single'].forEach((m) => {
    chain[m] = jest.fn(() => chain)
  })
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
  return {
    supabase: {
      auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'u-a' } }, error: null })) },
      from: jest.fn(() => chain),
      rpc: jest.fn(() => Promise.resolve({ data: { sessions: 1 }, error: null })),
    },
  }
})

const rpc = supabase.rpc as unknown as jest.Mock
// Token em cache de conta EXCLUÍDA em outro aparelho: o metadata ainda diz que ela consentiu.
const session = { user: { user_metadata: { health_consent: true } } }

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

function wrap(canAutoWrite: boolean, verificationPending = false) {
  return ({ children }: { children: React.ReactNode }) => (
    <ConsentGateProvider session={session} canAutoWrite={canAutoWrite} verificationPending={verificationPending}>
      {children}
    </ConsentGateProvider>
  )
}

it('conta não confirmada ⇒ zero RPC de escrita (consent_grant nem contagem de prompt)', async () => {
  const { result } = renderHook(() => useConsentGate(), { wrapper: wrap(false) })
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(rpc).not.toHaveBeenCalled()
})

it('conta confirmada ⇒ materializa o consentimento do cadastro (comportamento preservado)', async () => {
  const { result } = renderHook(() => useConsentGate(), { wrapper: wrap(true) })
  await waitFor(() => expect(result.current.ready).toBe(true))
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('consent_grant', expect.anything()))
})

it('RC5: verificação pendente ⇒ gate não decide (sem ready, sem leitura) — o pedido não pisca', async () => {
  const { result } = renderHook(() => useConsentGate(), { wrapper: wrap(false, true) })
  await new Promise((r) => setTimeout(r, 20))
  expect(result.current.ready).toBe(false)
  expect(supabase.from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})
