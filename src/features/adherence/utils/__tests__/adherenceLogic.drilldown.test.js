import { describe, it, expect } from 'vitest';
import { calculateDosesByDate } from '../adherenceLogic';

describe('calculateDosesByDate', () => {
  const baseDate = '2026-02-11';

  describe('daily frequency protocols', () => {
    it('should mark all doses as missed when no logs', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00', '20:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(2);
      expect(result.missedDoses[0].scheduledTime).toBe('08:00');
      expect(result.missedDoses[1].scheduledTime).toBe('20:00');
    });

    it('should mark dose as taken when log within tolerance window', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      // Use local time string to avoid timezone issues in CI
      // 08:30 local time is within +/- 2h tolerance of 08:00 scheduled
      const baseDateObj = new Date(baseDate + 'T08:30:00');
      const localTimeString = baseDateObj.toISOString();

      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: localTimeString, // 08:30 local - dentro da janela de 08:00
          quantity_taken: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' },
          protocol: { name: 'Protocolo Manhã' }
        }
      ];

      const result = calculateDosesByDate(baseDate, logs, protocols);

      expect(result.takenDoses).toHaveLength(1);
      expect(result.missedDoses).toHaveLength(0);
      expect(result.takenDoses[0].scheduledTime).toBe('08:00');
    });

    it('should mark dose as missed when log outside tolerance window', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00', '20:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: '2026-02-11T14:00:00Z', // 11:00 local - fora da janela de 08:00
          quantity_taken: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' },
          protocol: { name: 'Protocolo Manhã' }
        }
      ];

      const result = calculateDosesByDate(baseDate, logs, protocols);

      expect(result.takenDoses).toHaveLength(1);
      expect(result.takenDoses[0].isExtra).toBe(true);
      expect(result.missedDoses).toHaveLength(2);
    });

    it('should handle all doses taken scenario', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00', '20:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      // Use local time strings to avoid timezone issues in CI
      // 08:30 and 20:30 local times are within tolerance of scheduled times
      const morningTime = new Date(baseDate + 'T08:30:00').toISOString();
      const eveningTime = new Date(baseDate + 'T20:30:00').toISOString();

      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: morningTime,
          quantity_taken: 1
        },
        {
          id: 'log-2',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: eveningTime,
          quantity_taken: 1
        }
      ];

      const result = calculateDosesByDate(baseDate, logs, protocols);

      expect(result.takenDoses).toHaveLength(2);
      expect(result.missedDoses).toHaveLength(0);
    });
  });

  describe('weekly frequency protocols', () => {
    it('should include doses only for matching weekday', () => {
      // 2026-02-11 é uma quarta-feira (dayOfWeek = 3)
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'semanal',
          days: ['quarta', 'sexta'],
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Vitamina D', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.missedDoses).toHaveLength(1);
      expect(result.missedDoses[0].scheduledTime).toBe('08:00');
    });

    it('should exclude doses for non-matching weekday', () => {
      // 2026-02-11 é uma quarta-feira (dayOfWeek = 3)
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'semanal',
          days: ['segunda', 'terça'], // Não inclui quarta
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Vitamina D', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });
  });

  describe('alternating days protocols', () => {
    it('should include dose on even days from start', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'dia_sim_dia_nao',
          start_date: '2026-02-11', // Dia 0
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Omeprazol', type: 'cápsula' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.missedDoses).toHaveLength(1);
    });

    it('should exclude dose on odd days from start', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'dia_sim_dia_nao',
          start_date: '2026-02-10', // Dia anterior (diferença = 1, ímpar)
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Omeprazol', type: 'cápsula' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });
  });

  describe('inactive protocols', () => {
    it('should exclude inactive protocols', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: false, // Inativo
          frequency: 'diário',
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty protocols array', () => {
      const result = calculateDosesByDate(baseDate, [], []);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });

    it('should handle null protocols', () => {
      const result = calculateDosesByDate(baseDate, [], null);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });

    it('should handle protocols with no time_schedule', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          time_schedule: [], // Vazio
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });

    it('should handle protocols before start date', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          start_date: '2026-02-15', // Data futura
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });

    it('should handle protocols after end date', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          end_date: '2026-02-01', // Data passada
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });

    it('should handle quando_necessário frequency', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'quando_necessário',
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Dipirona', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      // Doses "quando necessário" não devem ser esperadas
      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });

    it('should handle personalizado frequency', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'personalizado',
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Medicamento', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      // Frequência personalizada não deve gerar doses esperadas por padrão
      expect(result.takenDoses).toHaveLength(0);
      expect(result.missedDoses).toHaveLength(0);
    });
  });

  describe('multiple protocols', () => {
    it('should handle multiple protocols correctly', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        },
        {
          id: 'proto-2',
          medicine_id: 'med-2',
          active: true,
          frequency: 'diário',
          time_schedule: ['14:00', '20:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Ibuprofeno', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.missedDoses).toHaveLength(3);
      expect(result.missedDoses.some(d => d.scheduledTime === '08:00')).toBe(true);
      expect(result.missedDoses.some(d => d.scheduledTime === '14:00')).toBe(true);
      expect(result.missedDoses.some(d => d.scheduledTime === '20:00')).toBe(true);
    });
  });

  describe('missed dose structure', () => {
    it('should create proper missed dose structure', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00'],
          dosage_per_intake: 2,
          medicine: { name: 'Paracetamol', type: 'comprimido' }
        }
      ];

      const result = calculateDosesByDate(baseDate, [], protocols);

      expect(result.missedDoses).toHaveLength(1);
      
      const missed = result.missedDoses[0];
      expect(missed.id).toBe('missed-proto-1-08:00');
      expect(missed.protocol_id).toBe('proto-1');
      expect(missed.medicine_id).toBe('med-1');
      expect(missed.scheduledTime).toBe('08:00');
      expect(missed.expectedQuantity).toBe(2);
      expect(missed.quantity_taken).toBe(0);
      expect(missed.status).toBe('missed');
      expect(missed.isSynthetic).toBe(true);
      expect(missed.medicine).toEqual({ name: 'Paracetamol', type: 'comprimido' });
    });
  });
});
