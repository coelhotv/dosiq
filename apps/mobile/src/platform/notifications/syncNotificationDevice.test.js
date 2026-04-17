// Testes para syncNotificationDevice.js
// Valida: param validation, error handling, Supabase integration

import { describe, it, expect } from '@jest/globals'
import { syncNotificationDevice } from './syncNotificationDevice'

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

  describe('Supabase integration', () => {
    it('deve suceder com mock Supabase', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          upsert: jest.fn().mockResolvedValue({
            data: [{ id: 'device-1' }],
            error: null,
          }),
        }),
      }

      const result = await syncNotificationDevice({
        supabase: mockSupabase,
        userId: 'user-123',
        token: 'ExponentPushToken[abc123]',
      })

      expect(result).toEqual([{ id: 'device-1' }])
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_devices')
    })

    it('deve propagar erro do Supabase', async () => {
      const mockError = new Error('Network error')
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          upsert: jest.fn().mockResolvedValue({
            data: null,
            error: mockError,
          }),
        }),
      }

      const promise = syncNotificationDevice({
        supabase: mockSupabase,
        userId: 'user-123',
        token: 'ExponentPushToken[abc123]',
      })

      await expect(promise).rejects.toThrow('[syncNotificationDevice] Upsert failed: Network error')
    })

    it('upsert deve incluir onConflict', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          upsert: jest.fn().mockResolvedValue({
            data: [{ id: 'device-1' }],
            error: null,
          }),
        }),
      }

      await syncNotificationDevice({
        supabase: mockSupabase,
        userId: 'user-123',
        token: 'ExponentPushToken[abc123]',
      })

      const upsertCall = mockSupabase.from('notification_devices').upsert
      expect(upsertCall).toHaveBeenCalled()

      const [data, options] = upsertCall.mock.calls[0]
      expect(options).toEqual({ onConflict: 'provider,push_token' })
      expect(data.user_id).toBe('user-123')
      expect(data.push_token).toBe('ExponentPushToken[abc123]')
      expect(data.is_active).toBe(true)
    })
  })
})
