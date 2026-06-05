/**
 * Testes para undoDose e revertToUnregistered
 * Jest + jest-expo
 */

import { undoDose } from '../features/dose/services/doseService'

// Mock do supabase
jest.mock('../platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}))

// Mock do @dosiq/core
jest.mock('@dosiq/core', () => ({
  createDoseInstanceRepository: jest.fn(() => ({
    getById: jest.fn(),
    revertToUnregistered: jest.fn(),
    markTaken: jest.fn(),
    findAnchorInstance: jest.fn(),
  })),
  logSchema: {
    safeParse: jest.fn(),
  },
}))

// Mock dos analytics
jest.mock('../platform/analytics/firebaseAnalytics', () => ({
  logEvent: jest.fn(),
}))
jest.mock('../platform/analytics/analyticsEvents', () => ({
  EVENTS: { DOSE_LOGGED: 'dose_logged' },
}))
jest.mock('../shared/utils/debugLog', () => ({
  debugLog: jest.fn(),
}))

import { supabase } from '../platform/supabase/nativeSupabaseClient'
import { createDoseInstanceRepository } from '@dosiq/core'

describe('undoDose', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('undoDose — dose com log ancorado — reverte estoque e deleta log', async () => {
    // Setup
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    })

    const mockRepository = {
      getById: jest.fn().mockResolvedValue({
        id: 'inst-1',
        medicine_log_id: 'log-1',
        scheduled_for: '2020-01-01T08:00:00Z',
        tolerance_minutes: 30,
        medicine_id: 'med-1',
      }),
      revertToUnregistered: jest.fn().mockResolvedValue(true),
      markTaken: jest.fn(),
      findAnchorInstance: jest.fn(),
    }

    createDoseInstanceRepository.mockReturnValue(mockRepository)

    // Mock do encadeamento de supabase: .from().delete().eq().eq()
    const mockEq2 = jest.fn(() => ({ error: null }))
    const mockEq1 = jest.fn(() => ({ eq: mockEq2 }))
    const mockDelete = jest.fn(() => ({ eq: mockEq1 }))
    const mockFrom = jest.fn(() => ({ delete: mockDelete }))
    supabase.from.mockImplementation(mockFrom)

    // Mock do rpc
    supabase.rpc.mockResolvedValue({ error: null })

    // Execute
    const result = await undoDose('inst-1')

    // Assertions
    expect(result.success).toBe(true)
    expect(mockRepository.revertToUnregistered).toHaveBeenCalledWith('inst-1')
    expect(supabase.rpc).toHaveBeenCalledWith('restore_stock_for_log', {
      p_medicine_log_id: 'log-1',
      p_reason: 'dose_deleted_restore',
    })
    expect(mockFrom).toHaveBeenCalledWith('medicine_logs')
    expect(mockDelete).toHaveBeenCalled()
  })

  test('undoDose — dose sem log (instância sem medicine_log_id) — só reverte status', async () => {
    // Setup
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    })

    const mockRepository = {
      getById: jest.fn().mockResolvedValue({
        id: 'inst-2',
        medicine_log_id: null,
        scheduled_for: '2020-01-01T08:00:00Z',
        tolerance_minutes: 30,
        medicine_id: 'med-1',
      }),
      revertToUnregistered: jest.fn().mockResolvedValue(true),
      markTaken: jest.fn(),
      findAnchorInstance: jest.fn(),
    }

    createDoseInstanceRepository.mockReturnValue(mockRepository)

    // Execute
    const result = await undoDose('inst-2')

    // Assertions
    expect(result.success).toBe(true)
    expect(mockRepository.revertToUnregistered).toHaveBeenCalledWith('inst-2')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  test('undoDose — instância não encontrada — retorna erro', async () => {
    // Setup
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    })

    const mockRepository = {
      getById: jest.fn().mockResolvedValue(null),
      revertToUnregistered: jest.fn(),
      markTaken: jest.fn(),
      findAnchorInstance: jest.fn(),
    }

    createDoseInstanceRepository.mockReturnValue(mockRepository)

    // Execute
    const result = await undoDose('inst-not-found')

    // Assertions
    expect(result.success).toBe(false)
    expect(result.error).toBe('Registro não encontrado.')
  })

  test('undoDose — falha no restore_stock_for_log — retorna erro', async () => {
    // Setup
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    })

    const mockRepository = {
      getById: jest.fn().mockResolvedValue({
        id: 'inst-1',
        medicine_log_id: 'log-1',
        scheduled_for: '2020-01-01T08:00:00Z',
        tolerance_minutes: 30,
        medicine_id: 'med-1',
      }),
      revertToUnregistered: jest.fn().mockResolvedValue(true),
      markTaken: jest.fn(),
      findAnchorInstance: jest.fn(),
    }

    createDoseInstanceRepository.mockReturnValue(mockRepository)

    // Mock do rpc com erro
    supabase.rpc.mockResolvedValue({ error: new Error('rpc error') })

    // Execute
    const result = await undoDose('inst-1')

    // Assertions
    expect(result.success).toBe(false)
  })
})
