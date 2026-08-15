import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DoseEventCard from '../DoseEventCard'

function makeEvent(overrides: any = {}) {
  return {
    id: 'inst:1',
    type: 'dose',
    occurred_at: '2026-05-31T13:00:00.000Z',
    payload: {
      source: 'instance',
      status: 'taken',
      medicineName: 'Losartana',
      dosageUnit: 'mg',
      expectedDose: 50,
      quantityTaken: 1,
      logId: 'log-1',
      medicineId: 'med-1',
      protocolId: 'prot-1',
      ...(overrides.payload || {}),
    },
    ...overrides,
  }
}

describe('DoseEventCard', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('renderiza nome, dosagem e badge de status para evento tomado', () => {
    render(<DoseEventCard event={makeEvent()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Losartana')).toBeInTheDocument()
    expect(screen.getByText('50 mg')).toBeInTheDocument()
    expect(screen.getByText('Tomada')).toBeInTheDocument()
  })

  it('mostra ações de editar/excluir quando há log ancorado', () => {
    render(<DoseEventCard event={makeEvent()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByLabelText('Editar registro')).toBeInTheDocument()
    expect(screen.getByLabelText('Excluir registro')).toBeInTheDocument()
  })

  it('NÃO mostra ações para evento sem log (missed/pending)', () => {
    const missed = makeEvent({ payload: { status: 'missed', logId: null, medicineName: 'Losartana' } })
    render(<DoseEventCard event={missed} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Perdida')).toBeInTheDocument()
    expect(screen.queryByLabelText('Editar registro')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Excluir registro')).not.toBeInTheDocument()
  })

  it('067/FR-037: dose pulada exibe "Pulada" — nunca o fallback "Pendente"', () => {
    const skipped = makeEvent({ payload: { status: 'skipped_user', logId: null, medicineName: 'Amoxicilina' } })
    render(<DoseEventCard event={skipped} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Pulada')).toBeInTheDocument()
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument()
  })

  it('067: payload SEM status (ausência real) mantém o fallback "Pendente"', () => {
    const noStatus = makeEvent({ payload: { status: undefined, logId: null, medicineName: 'Losartana' } })
    render(<DoseEventCard event={noStatus} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Pendente')).toBeInTheDocument()
  })

  it('reconstrói o log do payload e o entrega ao onEdit', async () => {
    const onEdit = vi.fn()
    render(<DoseEventCard event={makeEvent()} onEdit={onEdit} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Editar registro'))
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'log-1', medicine_id: 'med-1', quantity_taken: 1 })
    )
  })

  it('chama onDelete com o id do log', async () => {
    const onDelete = vi.fn()
    render(<DoseEventCard event={makeEvent()} onEdit={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText('Excluir registro'))
    expect(onDelete).toHaveBeenCalledWith('log-1')
  })
})
