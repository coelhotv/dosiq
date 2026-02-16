import { describe, it, expect } from 'vitest'
import { isDoseInToleranceWindow, isProtocolFollowed } from '../adherenceLogic'

describe('adherenceLogic - Janela de Tolerância', () => {
  it('deve validar dose dentro da janela de +/- 2 horas', () => {
    const scheduledTime = '10:00'
    // 10:00 local -> 13:00 UTC (assumindo America/Sao_Paulo UTC-3 para o teste)
    // Mas o Date nativo usará o fuso do ambiente.

    const baseDate = new Date()
    baseDate.setHours(10, 0, 0, 0)

    const exact = baseDate.toISOString()
    expect(isDoseInToleranceWindow(scheduledTime, exact)).toBe(true)

    const twoHoursBefore = new Date(baseDate.getTime() - 2 * 60 * 60 * 1000).toISOString()
    expect(isDoseInToleranceWindow(scheduledTime, twoHoursBefore)).toBe(true)

    const twoHoursAfter = new Date(baseDate.getTime() + 2 * 60 * 60 * 1000).toISOString()
    expect(isDoseInToleranceWindow(scheduledTime, twoHoursAfter)).toBe(true)

    const tooEarly = new Date(baseDate.getTime() - 121 * 60 * 1000).toISOString()
    expect(isDoseInToleranceWindow(scheduledTime, tooEarly)).toBe(false)

    const tooLate = new Date(baseDate.getTime() + 121 * 60 * 1000).toISOString()
    expect(isDoseInToleranceWindow(scheduledTime, tooLate)).toBe(false)
  })

  it('isProtocolFollowed deve encontrar dose correta no dia', () => {
    const scheduledTime = '10:00'
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    const logs = [
      { taken_at: new Date(today.setHours(11, 30, 0, 0)).toISOString() }, // 1.5h depois
    ]

    expect(isProtocolFollowed(scheduledTime, logs, dateStr)).toBe(true)
  })
})
