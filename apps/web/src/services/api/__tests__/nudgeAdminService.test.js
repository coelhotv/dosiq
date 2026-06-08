import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

import { nudgeAdminService } from '../nudgeAdminService'
import { supabase } from '@shared/utils/supabase'

describe('nudgeAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('should fetch nudges', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    })

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ id: 1, title: 'Test' }],
            total: 1,
            page: 1,
            totalPages: 1,
          }),
      })
    )

    const result = await nudgeAdminService.getAll({ limit: 10, offset: 0 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].title).toBe('Test')
  })

  it('should create nudge', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    })

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'nudge-1', title: 'New Nudge' },
          }),
      })
    )

    const result = await nudgeAdminService.create({
      title: 'New Nudge',
      body: 'Test',
      target_view: 'dashboard',
      action_type: 'dismiss_only',
      platform: 'all',
    })

    expect(result.success).toBe(true)
  })

  it('should toggle nudge', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    })

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'nudge-1', is_active: true },
          }),
      })
    )

    const result = await nudgeAdminService.toggleActive('nudge-1', true)
    expect(result.success).toBe(true)
  })

  it('should throw on auth error', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    try {
      await nudgeAdminService.getAll()
      expect.fail('should throw')
    } catch (err) {
      expect(err.message).toContain('Não autenticado')
    }
  })
})
