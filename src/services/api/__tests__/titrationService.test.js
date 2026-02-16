import { describe, it, expect } from 'vitest'
import {
  calculateTitrationSteps,
  getDaysUntilNextStep,
  getStepProgress,
  formatDose,
  formatDaysRemaining,
  isTitrationActive,
  hasReachedTarget,
  getTitrationSummary,
} from '../titrationService'

describe('titrationService', () => {
  describe('calculateTitrationSteps', () => {
    it('should return empty result for protocol without titration schedule', () => {
      const result = calculateTitrationSteps({})
      expect(result.steps).toEqual([])
      expect(result.currentStep).toBe(0)
      expect(result.totalSteps).toBe(0)
    })

    it('should calculate steps for a protocol with titration schedule', () => {
      const protocol = {
        titration_schedule: [
          { dosage: 1, duration_days: 7, description: 'Etapa inicial' },
          { dosage: 2, duration_days: 7, description: 'Etapa intermediária' },
          { dosage: 3, duration_days: 7, description: 'Dose alvo' },
        ],
        current_stage_index: 0,
        stage_started_at: '2024-01-01T00:00:00Z',
        start_date: '2024-01-01',
        medicine: { dosage_unit: 'mg' },
      }

      const result = calculateTitrationSteps(protocol)
      expect(result.steps).toHaveLength(3)
      expect(result.totalSteps).toBe(3)
      expect(result.currentStep).toBe(1)
      expect(result.steps[0].status).toBe('current')
      expect(result.steps[1].status).toBe('future')
    })

    it('should mark completed stages correctly', () => {
      const protocol = {
        titration_schedule: [
          { dosage: 1, duration_days: 7, description: 'Etapa 1' },
          { dosage: 2, duration_days: 7, description: 'Etapa 2' },
          { dosage: 3, duration_days: 7, description: 'Etapa 3' },
        ],
        current_stage_index: 1,
        stage_started_at: '2024-01-08T00:00:00Z',
        start_date: '2024-01-01',
        medicine: { dosage_unit: 'mg' },
      }

      const result = calculateTitrationSteps(protocol)
      expect(result.steps[0].status).toBe('completed')
      expect(result.steps[1].status).toBe('current')
      expect(result.steps[2].status).toBe('future')
    })

    it('should calculate correct dates for each step', () => {
      const protocol = {
        titration_schedule: [
          { dosage: 1, duration_days: 7, description: 'Semana 1' },
          { dosage: 2, duration_days: 7, description: 'Semana 2' },
        ],
        current_stage_index: 0,
        stage_started_at: '2024-01-01T00:00:00Z',
        start_date: '2024-01-01',
        medicine: { dosage_unit: 'mg' },
      }

      const result = calculateTitrationSteps(protocol)
      expect(result.steps[0].startDate.toISOString()).toContain('2024-01-01')
      expect(result.steps[1].startDate.toISOString()).toContain('2024-01-08')
    })

    it('should use mg as default unit', () => {
      const protocol = {
        titration_schedule: [{ dosage: 1, duration_days: 7, description: 'Etapa 1' }],
        current_stage_index: 0,
        stage_started_at: '2024-01-01T00:00:00Z',
        medicine: null,
      }

      const result = calculateTitrationSteps(protocol)
      expect(result.steps[0].unit).toBe('mg')
    })
  })

  describe('getDaysUntilNextStep', () => {
    it('should return 0 for last step', () => {
      const steps = [{ endDate: new Date('2024-01-07') }, { endDate: new Date('2024-01-14') }]
      const result = getDaysUntilNextStep(1, steps, new Date('2024-01-01'))
      expect(result).toBe(0)
    })

    it('should calculate days remaining for current step', () => {
      const today = new Date()
      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + 5)

      const steps = [
        { endDate: futureDate },
        { endDate: new Date(today.getTime() + 86400000 * 10) },
      ]

      const result = getDaysUntilNextStep(0, steps, today)
      expect(result).toBeGreaterThanOrEqual(4)
      expect(result).toBeLessThanOrEqual(6)
    })

    it('should return 0 when no current step', () => {
      const result = getDaysUntilNextStep(0, [], new Date())
      expect(result).toBe(0)
    })
  })

  describe('getStepProgress', () => {
    it('should return 0 when step not started', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)

      const steps = [
        {
          startDate: futureDate,
          endDate: new Date(futureDate.getTime() + 86400000 * 7),
          durationDays: 7,
        },
      ]

      const result = getStepProgress(0, steps, new Date())
      expect(result).toBe(0)
    })

    it('should return 100 when step completed', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      const steps = [
        {
          startDate: pastDate,
          endDate: new Date(pastDate.getTime() + 86400000 * 7),
          durationDays: 7,
        },
      ]

      const result = getStepProgress(0, steps, pastDate)
      expect(result).toBe(100)
    })

    it('should calculate progress for ongoing step', () => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 3)
      const endDate = new Date(startDate.getTime() + 86400000 * 6)

      const steps = [{ startDate, endDate, durationDays: 7 }]

      const result = getStepProgress(0, steps, startDate)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(100)
    })
  })

  describe('formatDose', () => {
    it('should format dose with unit', () => {
      expect(formatDose(2, 'mg')).toBe('2 mg')
      expect(formatDose(1, 'comprimido')).toBe('1 comprimido')
    })

    it('should calculate total mg when dosagePerPill is provided', () => {
      expect(formatDose(2, 'mg', 500)).toBe('1000mg (2 comp.)')
    })

    it('should handle single unit', () => {
      expect(formatDose(1, 'cápsula')).toBe('1 cápsula')
    })
  })

  describe('formatDaysRemaining', () => {
    it('should return message for last step', () => {
      expect(formatDaysRemaining(0)).toBe('Última etapa')
    })

    it('should return singular for 1 day', () => {
      expect(formatDaysRemaining(1)).toBe('1 dia restante')
    })

    it('should return plural for multiple days', () => {
      expect(formatDaysRemaining(5)).toBe('5 dias restantes')
    })
  })

  describe('isTitrationActive', () => {
    it('should return true for active titration', () => {
      const protocol = {
        titration_status: 'titulando',
        titration_schedule: [{ dosage: 1, duration_days: 7 }],
      }
      expect(isTitrationActive(protocol)).toBe(true)
    })

    it('should return false when status is not titulando', () => {
      const protocol = {
        titration_status: 'estável',
        titration_schedule: [{ dosage: 1, duration_days: 7 }],
      }
      expect(isTitrationActive(protocol)).toBe(false)
    })

    it('should return false when no titration schedule', () => {
      const protocol = {
        titration_status: 'titulando',
        titration_schedule: [],
      }
      expect(isTitrationActive(protocol)).toBe(false)
    })

    it('should return false for null protocol', () => {
      expect(isTitrationActive(null)).toBe(false)
    })
  })

  describe('hasReachedTarget', () => {
    it('should return true when target reached', () => {
      const protocol = { titration_status: 'alvo_atingido' }
      expect(hasReachedTarget(protocol)).toBe(true)
    })

    it('should return false when not at target', () => {
      const protocol = { titration_status: 'titulando' }
      expect(hasReachedTarget(protocol)).toBe(false)
    })

    it('should return false for null protocol', () => {
      expect(hasReachedTarget(null)).toBe(false)
    })
  })

  describe('getTitrationSummary', () => {
    it('should return null when no active titration', () => {
      const protocol = {
        titration_status: 'estável',
        titration_schedule: [],
      }
      expect(getTitrationSummary(protocol)).toBeNull()
    })

    it('should return summary for active titration', () => {
      const protocol = {
        titration_status: 'titulando',
        titration_schedule: [{ dosage: 1, duration_days: 7, description: 'Etapa 1' }],
        current_stage_index: 0,
        stage_started_at: '2024-01-01T00:00:00Z',
        start_date: '2024-01-01',
        dosage_per_intake: 1,
        medicine: { dosage_unit: 'mg' },
      }

      const result = getTitrationSummary(protocol)
      expect(result).not.toBeNull()
      expect(result.currentStep).toBe(1)
      expect(result.totalSteps).toBe(1)
      expect(result.isComplete).toBe(false)
    })

    it('should return summary for completed titration', () => {
      const protocol = {
        titration_status: 'alvo_atingido',
        titration_schedule: [
          { dosage: 1, duration_days: 7, description: 'Etapa 1' },
          { dosage: 2, duration_days: 7, description: 'Etapa 2' },
        ],
        current_stage_index: 1,
        stage_started_at: '2024-01-08T00:00:00Z',
        start_date: '2024-01-01',
        dosage_per_intake: 2,
        medicine: { dosage_unit: 'mg' },
      }

      const result = getTitrationSummary(protocol)
      expect(result).not.toBeNull()
      expect(result.isComplete).toBe(true)
    })

    it('should include estimated end date', () => {
      const protocol = {
        titration_status: 'titulando',
        titration_schedule: [{ dosage: 1, duration_days: 7, description: 'Etapa 1' }],
        current_stage_index: 0,
        stage_started_at: '2024-01-01T00:00:00Z',
        start_date: '2024-01-01',
        dosage_per_intake: 1,
        medicine: { dosage_unit: 'mg' },
      }

      const result = getTitrationSummary(protocol)
      expect(result.estimatedEndDate).toBeInstanceOf(Date)
    })
  })
})
