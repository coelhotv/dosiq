import { describe, it, expect } from 'vitest';
import { 
  formatMedicineWithStrength, 
  formatIntakeQuantity 
} from '../notificationHelpers.js';

describe('notificationHelpers', () => {
  describe('formatMedicineWithStrength', () => {
    it('should return only name if strength is missing', () => {
      expect(formatMedicineWithStrength('Omega 3', null, 'mg')).toBe('Omega 3');
      expect(formatMedicineWithStrength('Omega 3', 0, 'mg')).toBe('Omega 3');
    });

    it('should format name with strength and unit', () => {
      expect(formatMedicineWithStrength('Omega 3', 1200, 'mg')).toBe('Omega 3 1200mg');
    });

    it('should format name with strength even if unit is missing', () => {
      expect(formatMedicineWithStrength('Omega 3', 1200, null)).toBe('Omega 3 1200');
    });
  });

  describe('formatIntakeQuantity', () => {
    it('should return "cp" for weight units', () => {
      expect(formatIntakeQuantity(3, 'mg')).toBe('3 cp');
      expect(formatIntakeQuantity(1, 'mcg')).toBe('1 cp');
      expect(formatIntakeQuantity(2, 'g')).toBe('2 cp');
      expect(formatIntakeQuantity(1, 'ui')).toBe('1 cp');
    });

    it('should keep original unit for liquids and forms', () => {
      expect(formatIntakeQuantity(20, 'gotas')).toBe('20 gotas');
      expect(formatIntakeQuantity(5, 'ml')).toBe('5 ml');
      expect(formatIntakeQuantity(2, 'cp')).toBe('2 cp');
    });

    it('should use "dose" for unknown or missing units', () => {
      expect(formatIntakeQuantity(1, null)).toBe('1 dose');
      expect(formatIntakeQuantity(1, 'unidade')).toBe('1 unidade');
    });

    it('should handle case insensitivity', () => {
      expect(formatIntakeQuantity(1, 'MG')).toBe('1 cp');
      expect(formatIntakeQuantity(10, 'ML')).toBe('10 ml');
    });
  });
});
