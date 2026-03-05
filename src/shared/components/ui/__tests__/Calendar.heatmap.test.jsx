import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import Calendar from '../Calendar'

afterEach(() => {
  vi.clearAllMocks()
})

// Gera uma chave YYYY-MM-DD para data relativa a hoje
function dateKey(daysAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

describe('Calendar — heat map de adesão (W1-08)', () => {
  it('aplica classe has-adherence em dia com adherenceData', () => {
    const today = dateKey(0)
    const adherenceData = {
      [today]: { adherence: 100, taken: 4, expected: 4 },
    }
    const { container } = render(<Calendar adherenceData={adherenceData} />)
    const heatDays = container.querySelectorAll('.calendar-day.has-adherence')
    expect(heatDays.length).toBeGreaterThan(0)
  })

  it('aplica --heat-color com color-success para adesão 100%', () => {
    const today = dateKey(0)
    const adherenceData = {
      [today]: { adherence: 100, taken: 4, expected: 4 },
    }
    const { container } = render(<Calendar adherenceData={adherenceData} />)
    const heatDay = container.querySelector('.calendar-day.has-adherence')
    expect(heatDay.style.getPropertyValue('--heat-color')).toBe('var(--color-success)')
  })

  it('aplica --heat-color com color-warning para adesão parcial', () => {
    const today = dateKey(0)
    const adherenceData = {
      [today]: { adherence: 50, taken: 2, expected: 4 },
    }
    const { container } = render(<Calendar adherenceData={adherenceData} />)
    const heatDay = container.querySelector('.calendar-day.has-adherence')
    expect(heatDay.style.getPropertyValue('--heat-color')).toBe('var(--color-warning)')
  })

  it('aplica --heat-color com color-error para adesão 0%', () => {
    const today = dateKey(0)
    const adherenceData = {
      [today]: { adherence: 0, taken: 0, expected: 4 },
    }
    const { container } = render(<Calendar adherenceData={adherenceData} />)
    const heatDay = container.querySelector('.calendar-day.has-adherence')
    expect(heatDay.style.getPropertyValue('--heat-color')).toBe('var(--color-error)')
  })

  it('não aplica heat color em dia sem doses esperadas', () => {
    const today = dateKey(0)
    const adherenceData = {
      [today]: { adherence: 0, taken: 0, expected: 0 },
    }
    const { container } = render(<Calendar adherenceData={adherenceData} />)
    const heatDays = container.querySelectorAll('.calendar-day.has-adherence')
    expect(heatDays.length).toBe(0)
  })

  it('dias sem adherenceData não recebem has-adherence', () => {
    const { container } = render(<Calendar adherenceData={{}} />)
    const heatDays = container.querySelectorAll('.calendar-day.has-adherence')
    expect(heatDays.length).toBe(0)
  })

  it('markedDates continua funcionando quando adherenceData está vazio', () => {
    const today = dateKey(0)
    const { container } = render(
      <Calendar markedDates={[today]} adherenceData={{}} />
    )
    const logDays = container.querySelectorAll('.calendar-day.has-log')
    expect(logDays.length).toBeGreaterThan(0)
  })

  it('log-dot é omitido quando o dia tem adherenceData (heat color sobrescreve)', () => {
    const today = dateKey(0)
    const adherenceData = {
      [today]: { adherence: 100, taken: 4, expected: 4 },
    }
    const { container } = render(
      <Calendar markedDates={[today]} adherenceData={adherenceData} />
    )
    // has-adherence dias não renderizam log-dot (CSS visual, mas verificamos pela ausência no DOM)
    const heatDay = container.querySelector('.calendar-day.has-adherence')
    expect(heatDay).toBeTruthy()
    const logDot = heatDay.querySelector('.log-dot')
    expect(logDot).toBeNull()
  })
})
