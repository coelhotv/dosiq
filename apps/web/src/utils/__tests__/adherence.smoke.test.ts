import { describe, it, expect } from 'vitest'
import { isDoseInToleranceWindow, computeAdherenceFromInstances } from '@/utils/adherenceLogic'

describe('Smoke: Adherence Logic', () => {
  it('detects dose within tolerance window', () => {
    const scheduledTime = '10:00'
    const takenTime = new Date().toISOString()

    const result = isDoseInToleranceWindow(scheduledTime, takenTime)
    expect(typeof result).toBe('boolean')
  })

  it('computes adherence from instances (fonte única, ADR-054)', () => {
    const instances = [
      { status: 'taken' },
      { status: 'taken' },
      { status: 'missed' },
    ]
    const result = computeAdherenceFromInstances(instances)
    expect(typeof result).toBe('object')
    expect(typeof result.rate).toBe('number')
    expect(result.rate).toBeGreaterThanOrEqual(0)
    expect(result.rate).toBeLessThanOrEqual(1)
  })
})
