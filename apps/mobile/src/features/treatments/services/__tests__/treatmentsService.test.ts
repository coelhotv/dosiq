// treatmentsService — o select de medicine precisa trazer `presentation`: sem ela `isInjectable()`
// é sempre falso e o lote aberto pelo FAB/lembrete esconde o bloco de local (031/071, smoke 2026-10-01).

import { describe, it, expect, afterEach } from '@jest/globals'

const mockSelect = jest.fn()

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => {
  const orderMock = () => Promise.resolve({ data: [], error: null })
  const eqMock = () => ({ order: orderMock })
  return {
    supabase: {
      from: () => ({
        select: (...args) => {
          mockSelect(...args)
          return { eq: eqMock }
        },
      }),
    },
  }
})

import { getActiveTreatments } from '../treatmentsService'

describe('getActiveTreatments — select', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('traz medicine.presentation (gate do bloco de local no lote)', async () => {
    const res = await getActiveTreatments('11111111-1111-4111-8111-111111111111')
    expect(res.success).toBe(true)
    const select = String(mockSelect.mock.calls[0][0]).replace(/\s+/g, '')
    expect(select).toMatch(/medicine:medicine_id\([^)]*\bpresentation\b/)
  })
})
