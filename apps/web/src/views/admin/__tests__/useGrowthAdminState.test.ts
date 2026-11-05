import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@services/api/growthAdminService', () => ({
  growthAdminService: { load: vi.fn() },
}))

import { useGrowthAdminState, filterGrowthUsers, type GrowthUser } from '../useGrowthAdminState'
import { growthAdminService } from '@services/api/growthAdminService'

const svc = growthAdminService as any

const user = (over: Partial<GrowthUser>): GrowthUser => ({
  user_id: 'aaaaaaaa-0000-4000-8000-000000000000',
  email: 'ana@exemplo.com',
  created_at: '2026-11-01T12:00:00Z',
  last_activity_at: null,
  platforms: ['ios'],
  platform: 'ios',
  app_version: '0.34.0',
  push_active: true,
  onboarding_completed: true,
  protocols_count: 1,
  treatments: [],
  ...over,
})

const USERS = [
  user({}),
  // deslogou do app: sem aparelho vinculado, mas já usou Android e Web (D-AN-2)
  user({ user_id: 'bbbbbbbb-0000-4000-8000-000000000000', email: 'BRUNO@exemplo.com', platforms: ['android', 'web'], platform: 'web', push_active: false }),
  user({ user_id: 'cccccccc-0000-4000-8000-000000000000', email: null, platforms: [], platform: null, push_active: false }),
]

describe('filterGrowthUsers', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('busca por e-mail sem caixa e por id; e-mail nulo não quebra', () => {
    expect(filterGrowthUsers(USERS, { query: 'bruno', platform: 'all', push: 'all' })).toHaveLength(1)
    expect(filterGrowthUsers(USERS, { query: ' cccccccc ', platform: 'all', push: 'all' })).toHaveLength(1)
    expect(filterGrowthUsers(USERS, { query: '', platform: 'all', push: 'all' })).toHaveLength(3)
  })

  it('plataforma casa com qualquer canal já usado; "none" pega quem não tem registro', () => {
    expect(filterGrowthUsers(USERS, { query: '', platform: 'ios', push: 'all' }).map((u) => u.email)).toEqual(['ana@exemplo.com'])
    expect(filterGrowthUsers(USERS, { query: '', platform: 'web', push: 'all' }).map((u) => u.email)).toEqual(['BRUNO@exemplo.com'])
    expect(filterGrowthUsers(USERS, { query: '', platform: 'none', push: 'all' })).toHaveLength(1)
    expect(filterGrowthUsers(USERS, { query: '', platform: 'all', push: 'inactive' })).toHaveLength(2)
    expect(filterGrowthUsers(USERS, { query: '', platform: 'android', push: 'active' })).toHaveLength(0)
  })

  it('lista ausente vira vazia', () => {
    expect(filterGrowthUsers(undefined, { query: 'x', platform: 'all', push: 'all' })).toEqual([])
  })
})

describe('useGrowthAdminState', () => {
  beforeEach(() => {
    svc.load.mockResolvedValue({ users: USERS, excluded_count: 2 })
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('carrega, filtra no cliente sem novo fetch e reseta filtros', async () => {
    const { result } = renderHook(() => useGrowthAdminState())
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.filteredUsers).toHaveLength(3)

    act(() => { result.current.setPlatformFilter('android') })
    expect(result.current.filteredUsers).toHaveLength(1)
    expect(result.current.hasActiveFilters).toBe(true)
    expect(svc.load).toHaveBeenCalledTimes(1)

    act(() => { result.current.resetFilters() })
    expect(result.current.filteredUsers).toHaveLength(3)
    expect(result.current.hasActiveFilters).toBe(false)
  })

  it('expande e recolhe o drill-down por usuário', async () => {
    const { result } = renderHook(() => useGrowthAdminState())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.toggleExpanded(USERS[0].user_id) })
    expect(result.current.expandedUserIds.has(USERS[0].user_id)).toBe(true)
    act(() => { result.current.toggleExpanded(USERS[0].user_id) })
    expect(result.current.expandedUserIds.size).toBe(0)
  })

  it('falha do servidor vira erro e o reload tenta de novo', async () => {
    svc.load.mockRejectedValueOnce(new Error('Não autorizado.'))
    const { result } = renderHook(() => useGrowthAdminState())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Não autorizado.')
    expect(result.current.data).toBeNull()

    await act(async () => { await result.current.reload() })
    expect(result.current.error).toBeNull()
    expect(result.current.data?.excluded_count).toBe(2)
  })
})
