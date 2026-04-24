import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationLogRepository } from './notificationLogRepository.js';
import { supabase } from '../../services/supabase.js';

// Mock do Supabase
vi.mock('../../services/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'log-123' }, error: null }))
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() => Promise.resolve({ data: [{ id: 'log-1' }], error: null }))
          }))
        }))
      }))
    }))
  }
}));

describe('notificationLogRepository', () => {
  const mockUserId = '82ae6c78-b11a-4ea3-8884-63303d8a964a';
  const mockProtocolId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('deve inserir um novo log com sucesso', async () => {
      const mockData = {
        user_id: mockUserId,
        protocol_id: mockProtocolId,
        notification_type: 'dose_reminder',
        status: 'enviada',
        provider_metadata: { telegram_message_id: 123 }
      };

      const result = await notificationLogRepository.create(mockData);

      expect(supabase.from).toHaveBeenCalledWith('notification_log');
      expect(result).toEqual({ id: 'log-123' });
    });

    it('deve lançar erro se a validação Zod falhar', async () => {
      const invalidData = {
        user_id: 'not-a-uuid',
        notification_type: 'invalid_type'
      };

      await expect(notificationLogRepository.create(invalidData)).rejects.toThrow();
    });
  });

  describe('listByUserId', () => {
    it('deve listar logs do usuário de forma paginada', async () => {
      const results = await notificationLogRepository.listByUserId(mockUserId, { limit: 10, offset: 0 });

      expect(supabase.from).toHaveBeenCalledWith('notification_log');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('log-1');
    });
  });
});
