// Testes para syncDeviceActivity.ts (spec 057 / ADR-089).
// Valida: throttle local (24h), upsert via RPC, best-effort (nunca lança).

import { describe, it, expect, afterEach } from '@jest/globals'

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: 17,
  },
}))

jest.mock('expo-device', () => ({
  modelName: 'iPhone 15 Pro',
}))

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '4.20.0',
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

import AsyncStorageImport from '@react-native-async-storage/async-storage'
const AsyncStorage = AsyncStorageImport as any

import { syncDeviceActivity } from './syncDeviceActivity'

describe('syncDeviceActivity', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('não faz nada se supabase ausente', async () => {
    await syncDeviceActivity({ supabase: null })
    expect(AsyncStorage.getItem).not.toHaveBeenCalled()
  })

  it('chama rpc upsert_device_activity com os params corretos quando nunca houve heartbeat', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const mockSupabase = { rpc: jest.fn().mockResolvedValue({ error: null }) }

    await syncDeviceActivity({ supabase: mockSupabase, now: () => 1000 })

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'upsert_device_activity',
      expect.objectContaining({
        p_platform:    'ios',
        p_app_version: '4.20.0',
      })
    )
    const [, params] = mockSupabase.rpc.mock.calls[0]
    const fingerprint = JSON.parse(params.p_device_fingerprint)
    expect(fingerprint).toMatchObject({ os: 'ios', osVersion: 17, deviceModel: 'iPhone 15 Pro' })
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.stringContaining('device-activity-last-heartbeat'), '1000')
  })

  it('throttle bloqueia 2ª chamada antes de 24h', async () => {
    const ONE_HOUR = 60 * 60 * 1000
    AsyncStorage.getItem.mockResolvedValue(String(1000))
    const mockSupabase = { rpc: jest.fn().mockResolvedValue({ error: null }) }

    await syncDeviceActivity({ supabase: mockSupabase, now: () => 1000 + ONE_HOUR })

    expect(mockSupabase.rpc).not.toHaveBeenCalled()
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
  })

  it('chamada passa depois de 24h desde o último heartbeat', async () => {
    const TWENTY_FIVE_HOURS = 25 * 60 * 60 * 1000
    AsyncStorage.getItem.mockResolvedValue(String(1000))
    const mockSupabase = { rpc: jest.fn().mockResolvedValue({ error: null }) }

    await syncDeviceActivity({ supabase: mockSupabase, now: () => 1000 + TWENTY_FIVE_HOURS })

    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('device-activity-last-heartbeat'),
      String(1000 + TWENTY_FIVE_HOURS)
    )
  })

  it('erro de rede no RPC não lança pro caller (best-effort)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const mockSupabase = { rpc: jest.fn().mockResolvedValue({ error: { message: 'Network error' } }) }

    await expect(syncDeviceActivity({ supabase: mockSupabase, now: () => 1000 })).resolves.toBeUndefined()
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
  })

  it('exceção lançada pelo client (rpc rejeita) não propaga pro caller (best-effort)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const mockSupabase = { rpc: jest.fn().mockRejectedValue(new Error('boom')) }

    await expect(syncDeviceActivity({ supabase: mockSupabase, now: () => 1000 })).resolves.toBeUndefined()
  })

  it('não inclui app_version no fingerprint (mesma estratégia da 043 — AP-208)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const mockSupabase = { rpc: jest.fn().mockResolvedValue({ error: null }) }

    await syncDeviceActivity({ supabase: mockSupabase, now: () => 1000 })

    const [, params] = mockSupabase.rpc.mock.calls[0]
    const fingerprint = JSON.parse(params.p_device_fingerprint)
    expect(fingerprint).not.toHaveProperty('appVersion')
  })
})
