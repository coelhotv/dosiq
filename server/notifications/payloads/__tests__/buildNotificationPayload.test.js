import { describe, it, expect } from 'vitest';
import { buildNotificationPayload } from '../buildNotificationPayload.js';

describe('buildNotificationPayload', () => {

  describe('daily_digest', () => {
    it('should generate rich body for Telegram and plain body for Push', () => {
      const data = {
        firstName: 'Antonio Coelho',
        hour: 16,
        pendingCount: 1,
        medicines: [{ name: 'Ansitec', time: '11:45', dosage: '1 mg' }]
      };

      const payload = buildNotificationPayload({ kind: 'daily_digest', data });

      // Verificação Rich (Telegram)
      expect(payload.body).toContain('*Antonio Coelho*');
      expect(payload.body).toContain('\\!'); // Escapado para MarkdownV2 (JSON string representation)
      // Note: in Vitest, we check the actual string content.
      // Since buildNotificationPayload uses template literals with \\!, the string has literal \!
      expect(payload.body).toMatch(/Antonio Coelho\*/);
      expect(payload.body).toContain('\n\n'); // Newlines reais

      // Verificação Plain (Push)
      expect(payload.pushBody).not.toContain('*');
      expect(payload.pushBody).not.toContain('\\!');
      expect(payload.pushBody).toContain('Antonio Coelho!');
      expect(payload.pushBody).toContain('\n\n');
    });

    it('should handle zero pending doses correctly', () => {
      const data = {
        firstName: 'Caio',
        hour: 8,
        pendingCount: 0,
        medicines: []
      };

      const payload = buildNotificationPayload({ kind: 'daily_digest', data });
      expect(payload.pushBody).toContain('Você está em dia');
      expect(payload.pushBody).not.toContain('\\!');
    });
  });

  describe('adherence_report', () => {
    it('should generate dual formats for adherence report', () => {
      const data = {
        firstName: 'Antonio',
        period: 'hoje',
        percentage: 85,
        taken: 6,
        total: 7,
        storytelling: 'Melhor que ontem!'
      };

      const payload = buildNotificationPayload({ kind: 'adherence_report', data });

      expect(payload.body).toContain('*Antonio*');
      expect(payload.body).toContain('*85%*');
      expect(payload.body).toContain('✅ *6* de *7*');
      
      expect(payload.pushBody).toContain('Olá, Antonio!');
      expect(payload.pushBody).toContain('adesão hoje foi de 85%');
      expect(payload.pushBody).toContain('✅ 6 de 7');
      expect(payload.pushBody).not.toContain('*');
    });
  });

  describe('dose_reminder', () => {
    it('should generate clean push body for single dose', () => {
      const data = {
        medicineName: 'Omega 3',
        time: '12:00'
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      expect(payload.body).toContain('*Omega 3*');
      expect(payload.pushBody).toBe('Está na hora de tomar Omega 3 (12:00).');
    });
  });
});
