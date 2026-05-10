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
      expect(payload.pushBody).toContain('\n'); // Verificamos que contém ao menos uma quebra de linha
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
    it('should generate clean push body for single dose without dosage', () => {
      const data = {
        medicineName: 'Omega 3',
        time: '12:00'
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      expect(payload.body).toContain('*Omega 3*');
      expect(payload.pushBody).toBe('Está na hora de tomar Omega 3 (12:00).');
    });

    it('should include dosage if provided', () => {
      const data = {
        medicineName: 'Omega 3 1200mg',
        time: '12:00',
        dosage: '3 cp'
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      expect(payload.body).toContain('*Omega 3 1200mg*');
      expect(payload.body).toContain('— **3 cp**');
      expect(payload.pushBody).toBe('Está na hora de tomar Omega 3 1200mg (12:00) — 3 cp.');
    });
  });

  describe('dose_reminder_by_plan', () => {
    it('should generate rich body for multiple medications in a plan', () => {
      const data = {
        planName: 'Protocolo VIP',
        planId: 'plan_123',
        scheduledTime: '09:00',
        hour: 9,
        doses: [
          { medicineName: 'Med A', dosagePerIntake: 1 },
          { medicineName: 'Med B', dosagePerIntake: 2 }
        ]
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_by_plan', data });
      
      expect(payload.body).toContain('*Protocolo VIP*');
      expect(payload.body).toContain('2 medicamentos agora');
      expect(payload.body).toContain('Med A');
      expect(payload.body).toContain('Med B');
      expect(payload.pushBody).toContain('doses do plano Protocolo VIP (09:00)');
      expect(payload.actions).toHaveLength(2);
      expect(payload.actions[0].id).toBe('take_plan');
    });
  });

  describe('dose_reminder_misc', () => {
    it('should generate rich body for miscellaneous doses', () => {
      const data = {
        scheduledTime: '22:00',
        hour: 22,
        doses: [
          { medicineName: 'Med X', dosagePerIntake: 1 }
        ]
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_misc', data });
      
      expect(payload.body).toContain('*Suas doses agora*');
      expect(payload.body).toContain('1 medicamento pendente');
      expect(payload.pushBody).toContain('1 medicamento pendente (22:00)');
      expect(payload.actions[0].id).toBe('take_misc');
    });
  });
});
