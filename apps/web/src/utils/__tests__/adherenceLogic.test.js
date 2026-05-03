import { describe, it, expect } from 'vitest'
import { isDoseInToleranceWindow, isProtocolFollowed } from '@/utils/adherenceLogic'

describe('adherenceLogic - Janela de Tolerância', () => {
  it('deve validar dose dentro da janela de +/- 2 horas', () => {
    const scheduledTime = '10:00'
    // Usamos strings com offset fixo de Brasília (-03:00) para garantir consistência no CI
    const dateStr = '2026-02-11'
    
    const exact = `${dateStr}T10:00:00-03:00`
    expect(isDoseInToleranceWindow(scheduledTime, exact)).toBe(true)

    const twoHoursBefore = `${dateStr}T08:00:00-03:00`
    expect(isDoseInToleranceWindow(scheduledTime, twoHoursBefore)).toBe(true)

    const twoHoursAfter = `${dateStr}T12:00:00-03:00`
    expect(isDoseInToleranceWindow(scheduledTime, twoHoursAfter)).toBe(true)

    const tooEarly = `${dateStr}T07:59:00-03:00`
    expect(isDoseInToleranceWindow(scheduledTime, tooEarly)).toBe(false)

    const tooLate = `${dateStr}T12:01:00-03:00`
    expect(isDoseInToleranceWindow(scheduledTime, tooLate)).toBe(false)
  })

  it('isProtocolFollowed deve encontrar dose correta no dia', () => {
    const scheduledTime = '10:00'
    const dateStr = '2026-02-11'
    const logs = [
      { taken_at: `${dateStr}T11:30:00-03:00` }, // 1.5h depois
    ]

    expect(isProtocolFollowed(scheduledTime, logs, dateStr)).toBe(true)
  })
})
