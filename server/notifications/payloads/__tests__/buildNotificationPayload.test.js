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

    it('should derive dosage from dosagePerIntake for normal single dose', () => {
      const data = {
        medicineName: 'Ansitec',
        time: '18:00',
        dosagePerIntake: 1.5,
        critical_alarm: false
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      expect(payload.pushBody).toBe('Está na hora de tomar Ansitec (18:00) — 1,5 cp.');
      expect(payload.body).toContain('Está na hora de tomar *Ansitec* \\(18:00\\) — **1,5 cp**\\.');
    });

    it('should generate clinical description name (dosageperpill unit) - qty un. for single dose', () => {
      const data = {
        medicineName: 'Dipirona',
        time: '12:00',
        dosagePerIntake: 2,
        dosagePerPill: 500,
        dosageUnit: 'mg',
        critical_alarm: true
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      // Dipirona (500mg) - 2 un.
      expect(payload.pushBody).toBe('💊 Medicamento essencial: hora do seu Dipirona (500mg) - 2 un. (12:00).');
      expect(payload.body).toContain('💊 *Medicamento essencial*: hora do seu *Dipirona \\(500mg\\) \\- 2 un\\.* \\(12:00\\)\\.');
    });
  });

  describe('dose_reminder_by_plan', () => {
    it('should generate legacy rich body and push body for normal plan', () => {
      const data = {
        planName: 'Protocolo VIP',
        planId: 'plan_123',
        scheduledTime: '09:00',
        hour: 9,
        doses: [
          { medicineName: 'Med A', dosagePerIntake: 1 },
          { medicineName: 'Med B', dosagePerIntake: 2 }
        ],
        critical_alarm: false
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_by_plan', data });
      
      expect(payload.body).toContain('*Protocolo VIP*');
      expect(payload.body).toContain('2 medicamentos agora');
      expect(payload.body).toContain('Med A — 1 cp');
      expect(payload.body).toContain('Med B — 2 cp');
      expect(payload.pushBody).toBe('Está na hora de tomar as doses do plano Protocolo VIP (09:00).\n• Med A — 1 cp\n• Med B — 2 cp');
      expect(payload.actions).toHaveLength(1);
      expect(payload.actions[0].id).toBe('take_plan');
    });

    it('should generate clinical body and push body for critical plan', () => {
      const data = {
        planName: 'Protocolo VIP',
        planId: 'plan_123',
        scheduledTime: '09:00',
        hour: 9,
        doses: [
          { medicineName: 'Med A', dosagePerIntake: 1, dosagePerPill: 500, dosageUnit: 'mg' },
          { medicineName: 'Med B', dosagePerIntake: 2, dosagePerPill: 10, dosageUnit: 'ml' }
        ],
        critical_alarm: true
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_by_plan', data });
      
      expect(payload.body).toContain('📋 *Uso essencial*');
      expect(payload.body).toContain('Med A \\(500mg\\) \\- 1 un\\.');
      expect(payload.body).toContain('Med B \\(10ml\\) \\- 2 un\\.');
      expect(payload.pushBody).toBe('📋 Uso essencial: hora dos medicamentos do plano Protocolo VIP (09:00).\n• Med A (500mg) - 1 un.\n• Med B (10ml) - 2 un.');
    });
  });

  describe('dose_reminder_misc', () => {
    it('should generate legacy body and push body for normal misc doses', () => {
      const data = {
        scheduledTime: '22:00',
        hour: 22,
        doses: [
          { medicineName: 'Med X', dosagePerIntake: 1.5 }
        ],
        critical_alarm: false
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_misc', data });
      
      expect(payload.body).toContain('*Suas doses agora*');
      expect(payload.body).toContain('1 medicamento pendente');
      expect(payload.body).toContain('Med X — 1,5 cp');
      expect(payload.pushBody).toBe('1 medicamento pendente (22:00):\n• Med X — 1,5 cp');
      expect(payload.actions[0].id).toBe('take_misc');
    });

    it('should generate clinical body and push body for critical misc doses', () => {
      const data = {
        scheduledTime: '22:00',
        hour: 22,
        doses: [
          { medicineName: 'Med X', dosagePerIntake: 1.5, dosagePerPill: 20, dosageUnit: 'mg' }
        ],
        critical_alarm: true
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_misc', data });
      
      expect(payload.body).toContain('💊 *Doses essenciais*');
      expect(payload.body).toContain('Med X \\(20mg\\) \\- 1,5 un\\.');
      expect(payload.pushBody).toBe('💊 Doses essenciais pendentes para as 22:00:\n• Med X (20mg) - 1,5 un.');
    });
  });
});
