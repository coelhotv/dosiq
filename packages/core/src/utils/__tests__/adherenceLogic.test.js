import { describe, it, expect } from 'vitest'
import { isDoseInToleranceWindow, isProtocolFollowed, evaluateDoseTimelineState } from '../adherenceLogic'

describe('adherenceLogic - Janela de Tolerância', () => {
  it('deve validar dose dentro da janela de +/- 2 horas', () => {
    const scheduledTime = '10:00'
    // 10:00 local -> 13:00 UTC (assumindo America/Sao_Paulo UTC-3 para o teste)
    // Mas o Date nativo usará o fuso do ambiente.

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

describe('adherenceLogic - evaluateDoseTimelineState', () => {
  it('deve classificar doses corretamente nos 5 estados táteis', () => {
    const date = '2026-04-19'
    const now = new Date(`${date}T12:00:00`) // Meio-dia

    const dosesObj = {
      takenDoses: [
        { id: '1', scheduledTime: '08:00', name: 'Remédio A' },
      ],
      missedDoses: [
        { id: '2', scheduledTime: '11:00', name: 'Remédio B' }, // 1h atrás (ATRASADA)
        { id: '3', scheduledTime: '09:00', name: 'Remédio C' }, // 3h atrás (PERDIDA)
      ],
      scheduledDoses: [
        { id: '4', scheduledTime: '13:00', name: 'Remédio D' }, // Em 1h (PROXIMA)
        { id: '5', scheduledTime: '15:00', name: 'Remédio E' }, // Em 3h (PLANEJADA)
      ],
    }

    const result = evaluateDoseTimelineState(date, dosesObj, now)

    // Verificar contagem e ordenação (08:00, 09:00, 11:00, 13:00, 15:00)
    expect(result).toHaveLength(5)
    expect(result[0].scheduledTime).toBe('08:00')
    expect(result[4].scheduledTime).toBe('15:00')

    // Verificar status
    const statusMap = result.reduce((acc, curr) => {
      acc[curr.id] = curr.timelineStatus
      return acc
    }, {})

    expect(statusMap['1']).toBe('TOMADA')
    expect(statusMap['3']).toBe('PERDIDA')
    expect(statusMap['2']).toBe('ATRASADA')
    expect(statusMap['4']).toBe('PROXIMA')
    expect(statusMap['5']).toBe('PLANEJADA')
  })

  it('deve respeitar a janela exata de 2h (120 min) para transição', () => {
    const date = '2026-04-19'
    const now = new Date(`${date}T12:00:00`)

    const dosesObj = {
      takenDoses: [],
      missedDoses: [
        { id: 'atrasada-limite', scheduledTime: '10:00' }, // 120min certinho
        { id: 'perdida-limite', scheduledTime: '09:59' },  // 121min
      ],
      scheduledDoses: [
        { id: 'proxima-limite', scheduledTime: '14:00' },   // 120min
        { id: 'planejada-limite', scheduledTime: '14:01' }, // 121min
      ],
    }

    const result = evaluateDoseTimelineState(date, dosesObj, now)
    const statusMap = result.reduce((acc, curr) => {
      acc[curr.id] = curr.timelineStatus
      return acc
    }, {})

    expect(statusMap['atrasada-limite']).toBe('ATRASADA')
    expect(statusMap['perdida-limite']).toBe('PERDIDA')
    expect(statusMap['proxima-limite']).toBe('PROXIMA')
    expect(statusMap['planejada-limite']).toBe('PLANEJADA')
  })
})

