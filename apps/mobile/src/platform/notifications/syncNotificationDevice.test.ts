// Testes para syncNotificationDevice.js
// Valida: param validation, error handling, integração via RPC

import { describe, it, expect } from '@jest/globals'
import { syncNotificationDevice } from './syncNotificationDevice'
import { getInstallId } from '@platform/telemetry/installId'

jest.mock('@platform/telemetry/installId', () => ({ getInstallId: jest.fn() }))

const INSTALL_ID = '22222222-2222-4222-8222-222222222222'
const mockedGetInstallId = jest.mocked(getInstallId)

beforeEach(() => {
  mockedGetInstallId.mockResolvedValue(INSTALL_ID)
})

afterEach(() => {
  jest.clearAllMocks()
})

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
  nativeApplicationVersion: '4.0.0',
}))

describe('syncNotificationDevice', () => {
  describe('validation', () => {
    it('deve rejeitar se supabase ausente', async () => {
      const promise = syncNotificationDevice({
        supabase: null,
        userId: 'user-123',
        token: 'ExponentPushToken[abc123]',
      })

      await expect(promise).rejects.toThrow('[syncNotificationDevice] supabase client required')
    })

    it('deve rejeitar se userId ausente', async () => {
      const promise = syncNotificationDevice({
        supabase: {},
        userId: null,
        token: 'ExponentPushToken[abc123]',
      })

      await expect(promise).rejects.toThrow('[syncNotificationDevice] userId required')
    })

    it('deve rejeitar se token ausente', async () => {
      const promise = syncNotificationDevice({
        supabase: {},
        userId: 'user-123',
        token: null,
      })

      await expect(promise).rejects.toThrow('[syncNotificationDevice] token required')
    })
  })

  describe('Supabase RPC integration', () => {
    it('deve chamar rpc upsert_notification_device com os params corretos', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ error: null }),
      }

      await syncNotificationDevice({
        supabase: mockSupabase,
        userId: 'user-123',
        token: 'ExponentPushToken[abc123]',
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'upsert_notification_device',
        expect.objectContaining({
          p_provider:   'expo',
          p_push_token: 'ExponentPushToken[abc123]',
          p_platform:   'ios',
          p_app_kind:   'native',
        })
      )
    })

    it('deve propagar erro do RPC', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          error: { message: 'Network error' },
        }),
      }

      const promise = syncNotificationDevice({
        supabase: mockSupabase,
        userId: 'user-123',
        token: 'ExponentPushToken[abc123]',
      })

      await expect(promise).rejects.toThrow('[syncNotificationDevice] Upsert failed: Network error')
    })

    it('deve incluir device_fingerprint com os campos corretos', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ error: null }),
      }

      await syncNotificationDevice({
        supabase: mockSupabase,
        userId: 'user-123',
        token: 'ExponentPushToken[abc123]',
      })

      const [, params] = mockSupabase.rpc.mock.calls[0]
      const fingerprint = JSON.parse(params.p_device_fingerprint)
      expect(fingerprint).toMatchObject({
        os: 'ios',
        osVersion: 17,
        deviceModel: 'iPhone 15 Pro',
      })
    })

    // FR-006 (043 Slice B): appVersion NÃO faz mais parte da identidade do device (fingerprint),
    // mas segue como atributo atualizável do row via p_app_version.
    it('não deve incluir appVersion no fingerprint, mas sim em p_app_version', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ error: null }),
      }

      await syncNotificationDevice({
        supabase: mockSupabase,
        userId: 'user-123',
        token: 'ExponentPushToken[abc123]',
      })

      const [, params] = mockSupabase.rpc.mock.calls[0]
      const fingerprint = JSON.parse(params.p_device_fingerprint)
      expect(fingerprint).not.toHaveProperty('appVersion')
      expect(params.p_app_version).toBe('4.0.0')
    })
  })

  // Spec 095 FR-009 / PO-6: o servidor desativa tokens anteriores DESTA instalação.
  describe('install_id (spec 095)', () => {
    it('envia o id da instalação', async () => {
      const mockSupabase = { rpc: jest.fn().mockResolvedValue({ error: null }) }
      await syncNotificationDevice({ supabase: mockSupabase, userId: 'user-123', token: 'ExponentPushToken[abc123]' })
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'upsert_notification_device',
        expect.objectContaining({ p_install_id: INSTALL_ID })
      )
    })

    it('sem id (storage falhou) registra pelo caminho legado, sem lançar', async () => {
      mockedGetInstallId.mockResolvedValue(null)
      const mockSupabase = { rpc: jest.fn().mockResolvedValue({ error: null }) }
      await expect(
        syncNotificationDevice({ supabase: mockSupabase, userId: 'user-123', token: 'ExponentPushToken[abc123]' })
      ).resolves.toBeUndefined()
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'upsert_notification_device',
        expect.objectContaining({ p_install_id: null })
      )
    })
  })
})
