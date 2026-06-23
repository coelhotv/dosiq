import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import HistoryDayPanel from '../HistoryDayPanel'

function doseEvent(id, status = 'taken') {
  return {
    id,
    type: 'dose',
    occurred_at: '2026-05-31T13:00:00.000Z',
    localDay: '2026-05-31',
    payload: { status, medicineName: 'Med', logId: status === 'taken' ? id : null },
  }
}

describe('HistoryDayPanel', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('mostra a contagem de doses no header (plural)', () => {
    render(
      <HistoryDayPanel
        selectedDate="2026-05-31"
        dayEvents={[doseEvent('a'), doseEvent('b', 'missed')]}
        onEditLog={vi.fn()}
        onDeleteLog={vi.fn()}
      />
    )
    expect(screen.getByText('Registros do dia')).toBeInTheDocument()
    // 2 eventos, 1 taken (doseEvent('a')) → "1/2 doses"
    expect(screen.getByText('1/2 doses')).toBeInTheDocument()
    expect(screen.getByTitle(/1 dose tomada de 2 agendadas/i)).toBeInTheDocument()
  })

  it('usa singular para uma única dose', () => {
    render(
      <HistoryDayPanel selectedDate="2026-05-31" dayEvents={[doseEvent('a')]} onEditLog={vi.fn()} onDeleteLog={vi.fn()} />
    )
    expect(screen.getByText('1/1 dose')).toBeInTheDocument()
  })

  it('renderiza estado vazio sem eventos', () => {
    render(<HistoryDayPanel selectedDate="2026-05-31" dayEvents={[]} onEditLog={vi.fn()} onDeleteLog={vi.fn()} />)
    expect(screen.getByText(/Nenhuma dose registrada/i)).toBeInTheDocument()
    expect(screen.getByText('0/0 doses')).toBeInTheDocument()
  })

  it('renderiza um card por evento via registry e ignora tipo desconhecido', () => {
    const unknown = { id: 'x', type: 'biomarker', occurred_at: '2026-05-31T10:00:00Z', localDay: '2026-05-31', payload: {} }
    render(
      <HistoryDayPanel
        selectedDate="2026-05-31"
        dayEvents={[doseEvent('a'), unknown]}
        onEditLog={vi.fn()}
        onDeleteLog={vi.fn()}
      />
    )
    // 1 card dose renderizado (nome aparece), biomarker ignorado sem quebrar.
    expect(screen.getByText('Med')).toBeInTheDocument()
    // contagem conta SÓ eventos type='dose' (biomarker excluído): 1 taken / 1 dose
    expect(screen.getByText('1/1 dose')).toBeInTheDocument()
  })
})
