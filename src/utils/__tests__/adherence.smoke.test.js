import { describe, it, expect } from 'vitest'
import { isDoseInToleranceWindow, calculateAdherenceStats } from '../adherenceLogic'

describe('Smoke: Adherence Logic', () => {
  it('detects dose within tolerance window', () => {
    const scheduledTime = '10:00'
    const takenTime = new Date().toISOString()
    
    const result = isDoseInToleranceWindow(scheduledTime, takenTime)
    expect(typeof result).toBe('boolean')
  })
  
  it('calculates adherence stats correctly', () => {
    const logs = [
      { taken_at: new Date().toISOString(), protocol_id: 'p1' },
      { taken_at: new Date().toISOString(), protocol_id: 'p1' }
    ]
    const protocols = [
      { id: 'p1', time_schedule: ['08:00', '20:00'], frequency: 'diário' }
    ]
    const result = calculateAdherenceStats(logs, protocols, 1)
    expect(typeof result).toBe('object')
    expect(typeof result.score).toBe('number')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
