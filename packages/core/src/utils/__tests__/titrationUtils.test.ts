import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { calculateTitrationData } from '../titrationUtils'

describe('calculateTitrationData', () => {
  const baseDate = '2024-01-01'
  let originalDate

  beforeEach(() => {
    // Store original Date constructor
    originalDate = global.Date
  })

  afterEach(() => {
    // Restore original Date constructor
    global.Date = originalDate
  })

  describe('protocol validation', () => {
    it('should return null when protocol has no titration_schedule', () => {
      const protocol = {
        titration_schedule: [],
        stage_started_at: baseDate,
      }

      expect(calculateTitrationData(protocol)).toBeNull()
    })

    it('should return null when titration_schedule is undefined', () => {
      const protocol = {
        stage_started_at: baseDate,
      }

      expect(calculateTitrationData(protocol)).toBeNull()
    })

    it('should return null when stage_started_at is not set', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
      }

      expect(calculateTitrationData(protocol)).toBeNull()
    })

    it('should return null when current_stage_index exceeds schedule length', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
        current_stage_index: 5,
      }

      expect(calculateTitrationData(protocol)).toBeNull()
    })
  })

  describe('current stage calculation', () => {
    it('should calculate correct current step (1-indexed)', () => {
      const protocol = {
        titration_schedule: [
          { days: 7, dosage: 1, note: 'Etapa 1' },
          { days: 7, dosage: 2, note: 'Etapa 2' },
          { days: 7, dosage: 3, note: 'Etapa 3' },
        ],
        stage_started_at: baseDate,
        current_stage_index: 1,
      }

      const result = calculateTitrationData(protocol)

      expect(result.currentStep).toBe(2)
      expect(result.totalSteps).toBe(3)
    })

    it('should default to stage 0 when current_stage_index is undefined', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1, note: 'Etapa 1' }],
        stage_started_at: baseDate,
      }

      const result = calculateTitrationData(protocol)

      expect(result.currentStep).toBe(1)
    })
  })

  describe('days calculation', () => {
    it('should calculate days elapsed correctly for single day', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be 1 day after start
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-02')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.day).toBe(1)
      expect(result.realDay).toBe(1)
    })

    it('should cap visual day at totalDays', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be 11 days after start (past the 7 day stage)
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-12')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.day).toBe(7) // Capped at totalDays
      expect(result.realDay).toBe(11) // Actual days elapsed (12 - 1 = 11, due to Math.ceil)
    })

    it('should ensure day is at least 1', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be same day as start
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-01')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.day).toBeGreaterThanOrEqual(1)
    })
  })

  describe('progress calculation', () => {
    it('should calculate progress percentage correctly at 50%', () => {
      const protocol = {
        titration_schedule: [{ days: 10, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be 5 days after start (50%)
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-06')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.progressPercent).toBe(50)
    })

    it('should cap progress at 100%', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be well past the stage end
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-20')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.progressPercent).toBe(100)
    })

    it('should calculate low progress at start', () => {
      const protocol = {
        titration_schedule: [{ days: 10, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be 1 day after start
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-02')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      // Day 1 of 10 days = 10%
      expect(result.progressPercent).toBe(10)
    })
  })

  describe('transition detection', () => {
    it('should indicate transition is due when days exceed total', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be past the stage end (day 9)
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-09')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.isTransitionDue).toBe(true)
    })

    it('should not indicate transition when within stage duration', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be within stage (day 5)
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-05')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.isTransitionDue).toBe(false)
    })
  })

  describe('days remaining calculation', () => {
    it('should calculate positive days remaining', () => {
      const protocol = {
        titration_schedule: [{ days: 10, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be day 3 (4th day)
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-04')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      // 10 - 3 = 7 days remaining
      expect(result.daysRemaining).toBe(7)
    })

    it('should calculate negative days remaining when past end', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
      }

      // Mock current date to be past stage end (day 10)
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-11')
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.daysRemaining).toBeLessThan(0)
    })
  })

  describe('stage note', () => {
    it('should return stage note from current stage', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1, note: 'Introdução gradual' }],
        stage_started_at: baseDate,
      }

      const result = calculateTitrationData(protocol)

      expect(result.stageNote).toBe('Introdução gradual')
    })

    it('should handle stage without note', () => {
      const protocol = {
        titration_schedule: [{ days: 7, dosage: 1 }],
        stage_started_at: baseDate,
      }

      const result = calculateTitrationData(protocol)

      expect(result.stageNote).toBeUndefined()
    })
  })

  describe('integration scenarios', () => {
    it('should handle multi-stage protocol correctly', () => {
      const protocol = {
        titration_schedule: [
          { days: 7, dosage: 0.5, note: 'Semana 1' },
          { days: 7, dosage: 1, note: 'Semana 2' },
          { days: 14, dosage: 2, note: 'Manutenção' },
        ],
        stage_started_at: baseDate,
        current_stage_index: 2,
      }

      // Mock current date to be 5 days into stage 3 (day 20 total)
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2024-01-20') // Day 20, stage 3 starts day 15
          } else {
            super(...(args as ConstructorParameters<typeof Date>))
          }
        }
      } as unknown as DateConstructor

      const result = calculateTitrationData(protocol)

      expect(result.currentStep).toBe(3)
      expect(result.totalSteps).toBe(3)
      expect(result.totalDays).toBe(14)
      expect(result.stageNote).toBe('Manutenção')
    })
  })
})

// ── 012 Fase B (FR-006/FP-1): resolução da etapa vigente num instante ──────────
import { resolveTitrationStageAt } from '../titrationUtils'

describe('resolveTitrationStageAt', () => {
  // GLP-1 clássico: 0,25mg/28d → 0,5mg/28d → 1,0mg/28d
  const glp1 = {
    titration_schedule: [
      { days: 28, dosage: 0.25 },
      { days: 28, dosage: 0.5 },
      { days: 28, dosage: 1.0 },
    ],
    current_stage_index: 0,
    stage_started_at: '2026-06-01T08:00:00.000Z',
    titration_status: 'titulando',
  }

  it('instante dentro da etapa atual → dose da etapa atual', () => {
    const out = resolveTitrationStageAt(glp1, '2026-06-15T08:00:00.000Z')
    expect(out).toEqual({ stageIndex: 0, dosage: 0.25 })
  })

  it('instante na 2ª etapa (29º dia) → dose da etapa futura (congela ANTES do avanço no banco)', () => {
    const out = resolveTitrationStageAt(glp1, '2026-06-30T08:00:00.000Z')
    expect(out).toEqual({ stageIndex: 1, dosage: 0.5 })
  })

  it('instante na 3ª etapa (57º dia) → caminha múltiplas etapas', () => {
    const out = resolveTitrationStageAt(glp1, '2026-07-28T08:00:00.000Z')
    expect(out).toEqual({ stageIndex: 2, dosage: 1.0 })
  })

  it('além do fim da última etapa → mantém dose alvo (última etapa)', () => {
    const out = resolveTitrationStageAt(glp1, '2026-12-01T08:00:00.000Z')
    expect(out).toEqual({ stageIndex: 2, dosage: 1.0 })
  })

  it('respeita current_stage_index como ponto de partida (avanço manual prévio)', () => {
    const p = { ...glp1, current_stage_index: 1, stage_started_at: '2026-06-29T08:00:00.000Z' }
    const out = resolveTitrationStageAt(p, '2026-07-01T08:00:00.000Z')
    expect(out).toEqual({ stageIndex: 1, dosage: 0.5 })
  })

  it('instante ANTERIOR ao início da etapa atual → null (histórico já congelado)', () => {
    expect(resolveTitrationStageAt(glp1, '2026-05-20T08:00:00.000Z')).toBeNull()
  })

  it('status estável/alvo_atingido → null (dosage_per_intake rege)', () => {
    expect(resolveTitrationStageAt({ ...glp1, titration_status: 'estável' }, '2026-06-15T08:00:00.000Z')).toBeNull()
    expect(resolveTitrationStageAt({ ...glp1, titration_status: 'alvo_atingido' }, '2026-06-15T08:00:00.000Z')).toBeNull()
  })

  it('degenerados → null: sem schedule, sem stage_started_at, índice fora, dose inválida, days inválido na etapa atual', () => {
    expect(resolveTitrationStageAt(null, '2026-06-15T08:00:00.000Z')).toBeNull()
    expect(resolveTitrationStageAt({ ...glp1, titration_schedule: [] }, '2026-06-15T08:00:00.000Z')).toBeNull()
    expect(resolveTitrationStageAt({ ...glp1, stage_started_at: null }, '2026-06-15T08:00:00.000Z')).toBeNull()
    expect(resolveTitrationStageAt({ ...glp1, current_stage_index: 9 }, '2026-06-15T08:00:00.000Z')).toBeNull()
    expect(resolveTitrationStageAt({ ...glp1, titration_schedule: [{ days: 28, dosage: 0 }] }, '2026-06-15T08:00:00.000Z')).toBeNull()
  })

  it('days inválido impede SAIR da etapa, não entrar nela (caminha até ela e para)', () => {
    const p = { ...glp1, titration_schedule: [{ days: 28, dosage: 0.25 }, { days: 0, dosage: 0.5 }] }
    const out = resolveTitrationStageAt(p, '2026-08-01T08:00:00.000Z')
    expect(out).toEqual({ stageIndex: 1, dosage: 0.5 })
  })
})

describe('resolveTitrationStageAt — shape canônico duration_days', () => {
  it('aceita duration_days (titrationStageSchema) além do legado days', () => {
    const p = {
      titration_schedule: [
        { duration_days: 28, dosage: 0.25 },
        { duration_days: 28, dosage: 0.5 },
      ],
      current_stage_index: 0,
      stage_started_at: '2026-06-01T08:00:00.000Z',
      titration_status: 'titulando',
    }
    expect(resolveTitrationStageAt(p, '2026-06-30T08:00:00.000Z')).toEqual({ stageIndex: 1, dosage: 0.5 })
  })
})
