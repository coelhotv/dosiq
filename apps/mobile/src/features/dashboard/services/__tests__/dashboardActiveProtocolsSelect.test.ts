// dashboardActiveProtocolsSelect.test.ts — spec 100 B · PO-10: o select que alimenta o pedido pós-dose
// (single, hero, deeplink) traz `tracked_measure`. `select()` é string: nem tsc nem mock de dado pegam
// a coluna esquecida (AP-300) — o teste lê a string; o curl R-295 (200 QA/prod) prova que ela existe.

const mockSelect = jest.fn()
jest.mock('@platform/supabase/nativeSupabaseClient', () => {
  const chain: any = {}
  ;['eq', 'lte', 'or'].forEach((m) => { chain[m] = () => chain })
  chain.order = () => Promise.resolve({ data: [], error: null })
  return {
    supabase: {
      from: () => ({
        select: (...args: unknown[]) => {
          mockSelect(...args)
          return chain
        },
      }),
    },
  }
})

import { getActiveProtocols } from '../dashboardService'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

it('getActiveProtocols seleciona tracked_measure no nível do protocolo', async () => {
  await getActiveProtocols('8c0633ef-a0f8-4b74-b1b8-92d4d47034e7', '2026-10-30')
  const select = String(mockSelect.mock.calls[0][0]).replace(/\s+/g, '')
  expect(select.split('treatment_plan:')[0].split(',')).toContain('tracked_measure')
})
