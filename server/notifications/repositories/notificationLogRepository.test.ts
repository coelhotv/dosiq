import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationLogRepository } from './notificationLogRepository';
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
      // `as const` no status: o create passou a exigir o vocabulário fechado do ADR-100 e um
      // `string` largo não é atribuível ao enum (082/T014).
      const mockData = {
        user_id: mockUserId,
        protocol_id: mockProtocolId,
        notification_type: 'dose_reminder',
        status: 'enviada' as const,
        provider_metadata: { telegram_message_id: 123 }
      };

      const result = await notificationLogRepository.create(mockData);

      expect(supabase.from).toHaveBeenCalledWith('notification_log');
      expect(result).toEqual({ id: 'log-123' });
    });

    it('🔴 082 Slice C: `suprimida_sem_prova` sobrevive ao safeParse e chega ao insert', async () => {
      // O `create` valida com o vocabulário FECHADO do ADR-100. Valor novo que não esteja no enum
      // é rejeitado aqui — antes de chegar ao banco — e a supressão viraria exceção no cron em vez
      // de linha gravada. Este teste é o par do CHECK: enum e constraint andam juntos (R-271).
      const result = await notificationLogRepository.create({
        user_id: mockUserId,
        protocol_id: mockProtocolId,
        notification_type: 'dose_reminder',
        status: 'suprimida_sem_prova' as const,
      });

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
