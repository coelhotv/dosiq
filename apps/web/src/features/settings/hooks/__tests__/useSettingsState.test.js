import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Mocks (antes dos imports do módulo testado) ──────────────────────────────
const updateEq = vi.fn(async () => ({ error: null }))
const update = vi.fn(() => ({ eq: updateEq }))
const single = vi.fn(async () => ({ data: { timezone: 'America/Sao_Paulo' } }))
const getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))

vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    auth: { getUser: (...a) => getUser(...a) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: (...a) => single(...a) })) })),
      update: (...a) => update(...a),
    })),
  },
}))

// Refs estáveis: setOverride NÃO pode ser recriado a cada render, senão a dep
// do useCallback(fetchData) muda → useEffect re-dispara → loop infinito.
const setOverrideStable = vi.fn()
vi.mock('@dashboard/hooks/useComplexityMode', () => ({
  useComplexityMode: () => ({ mode: 'simple', setOverride: setOverrideStable, overrideMode: null }),
}))

const hasFuturePendingDoses = vi.fn(async () => false)
const regenActiveProtocolsForTz = vi.fn(async () => ({ processed: 1, regenerated: 5, failed: 0 }))
vi.mock('@dosiq/core', () => ({
  hasFuturePendingDoses: (...a) => hasFuturePendingDoses(...a),
  regenActiveProtocolsForTz: (...a) => regenActiveProtocolsForTz(...a),
}))

const invalidateCache = vi.fn()
vi.mock('@shared/hooks/useCachedQuery', () => ({ invalidateCache: (...a) => invalidateCache(...a) }))
vi.mock('@dosiq/shared-data', () => ({
  CACHE_KEYS: { USER_TIMEZONE: 'user:timezone', DOSE_INSTANCES_TODAY: 'doseInstances:today:v2' },
}))

import { useSettingsState } from '../useSettingsState'

async function setupHook() {
  const view = renderHook(() => useSettingsState())
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  return view
}

describe('useSettingsState — troca de fuso (F4.3f.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    update.mockReturnValue({ eq: updateEq })
    updateEq.mockResolvedValue({ error: null })
    single.mockResolvedValue({ data: { timezone: 'America/Sao_Paulo' } })
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('tz igual ao atual → no-op (sem update, sem prompt)', async () => {
    const { result } = await setupHook()
    await act(async () => { await result.current.preference.handleTimezoneChange('America/Sao_Paulo') })
    expect(update).not.toHaveBeenCalled()
    expect(result.current.preference.tzPrompt).toBeNull()
  })

  it('sem dose futura → persiste direto, sem prompt e sem regen', async () => {
    hasFuturePendingDoses.mockResolvedValue(false)
    const { result } = await setupHook()
    await act(async () => { await result.current.preference.handleTimezoneChange('Europe/London') })
    expect(update).toHaveBeenCalledWith({ timezone: 'Europe/London' })
    expect(regenActiveProtocolsForTz).not.toHaveBeenCalled()
    expect(result.current.preference.tzPrompt).toBeNull()
    expect(result.current.preference.timezone).toBe('Europe/London')
    expect(invalidateCache).toHaveBeenCalledWith('user:timezone')
  })

  it('com dose futura → abre prompt sem persistir ainda', async () => {
    hasFuturePendingDoses.mockResolvedValue(true)
    const { result } = await setupHook()
    await act(async () => { await result.current.preference.handleTimezoneChange('Europe/London') })
    expect(update).not.toHaveBeenCalled()
    expect(result.current.preference.tzPrompt).toEqual({ fromTz: 'America/Sao_Paulo', toTz: 'Europe/London' })
  })

  it('viagem → persiste sem regen', async () => {
    hasFuturePendingDoses.mockResolvedValue(true)
    const { result } = await setupHook()
    await act(async () => { await result.current.preference.handleTimezoneChange('Europe/London') })
    await act(async () => { await result.current.preference.handleTzTravel() })
    expect(update).toHaveBeenCalledWith({ timezone: 'Europe/London' })
    expect(regenActiveProtocolsForTz).not.toHaveBeenCalled()
    expect(result.current.preference.tzPrompt).toBeNull()
    expect(result.current.preference.timezone).toBe('Europe/London')
  })

  it('mudança → persiste e regenera no tz novo', async () => {
    hasFuturePendingDoses.mockResolvedValue(true)
    const { result } = await setupHook()
    await act(async () => { await result.current.preference.handleTimezoneChange('Europe/London') })
    await act(async () => { await result.current.preference.handleTzMove() })
    expect(update).toHaveBeenCalledWith({ timezone: 'Europe/London' })
    expect(regenActiveProtocolsForTz).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', tz: 'Europe/London' }),
    )
    expect(result.current.preference.tzPrompt).toBeNull()
  })

  it('cancelar → nada muda', async () => {
    hasFuturePendingDoses.mockResolvedValue(true)
    const { result } = await setupHook()
    await act(async () => { await result.current.preference.handleTimezoneChange('Europe/London') })
    act(() => { result.current.preference.handleTzCancel() })
    expect(update).not.toHaveBeenCalled()
    expect(regenActiveProtocolsForTz).not.toHaveBeenCalled()
    expect(result.current.preference.tzPrompt).toBeNull()
    expect(result.current.preference.timezone).toBe('America/Sao_Paulo')
  })
})
