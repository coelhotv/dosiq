import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProtocolFormAdvancedSection from './ProtocolFormAdvancedSection'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
})

// 085 FR-008a: religar um tratamento pausado mostra a próxima dose, pelo motor do gerador.
const formData = {
  active: true,
  frequency: 'dias_alternados',
  time_schedule: ['08:00'],
  start_date: '2026-05-01',
  end_date: '',
  weekdays: [],
  notes: '',
}

describe('ProtocolFormAdvancedSection — aviso de retomada (085 FR-008a)', () => {
  it('pausado + religado: informa a próxima dose segundo a âncora do start_date', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime('2026-05-10T09:00:00-03:00') // 10/05 — dia sem dose (diff 9)
    render(<ProtocolFormAdvancedSection formData={formData} handleChange={vi.fn()} isSimpleMode={false} showTitration={false} wasPaused />)
    expect(screen.getByRole('status').textContent).toBe('Próxima dose: amanhã às 08:00.')
  })

  it('tratamento que já estava ativo não ganha aviso', () => {
    render(<ProtocolFormAdvancedSection formData={formData} handleChange={vi.fn()} isSimpleMode={false} showTitration={false} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('pausado e mantido pausado não ganha aviso', () => {
    render(
      <ProtocolFormAdvancedSection formData={{ ...formData, active: false }} handleChange={vi.fn()} isSimpleMode={false} showTitration={false} wasPaused />
    )
    expect(screen.queryByRole('status')).toBeNull()
  })
})
