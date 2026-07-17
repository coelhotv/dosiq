import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProtocolChecklistItem from './ProtocolChecklistItem'

describe('ProtocolChecklistItem', () => {
  it('renders correctly when not selected', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('💊 Manhã')).toBeInTheDocument()
    expect(screen.getByText('1 un.')).toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('renders correctly when selected', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={true} onToggle={onToggle} />)

    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('calls onToggle when clicked', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    fireEvent.click(screen.getByText('💊 Manhã'))

    expect(onToggle).toHaveBeenCalledWith('p1')
  })

  it('renders titration status badge when titulando', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
      titration_status: 'titulando',
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('📈 Titulando')).toBeInTheDocument()
  })

  it('renders stable status badge when estável', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
      titration_status: 'estável',
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('Estável')).toBeInTheDocument()
  })

  // 029 F3.1: removido 'renders titration scheduler data when present'. Montava
  // `titration_scheduler_data` à mão — um campo que NENHUM produtor do repositório escreve.
  // Ficou verde 6 meses provando um render que a produção nunca alcançou; o componente caía
  // sempre no ramo do badge. É a mesma armadilha do PO-5 (paridade com um cadáver): um teste só
  // vale se o estado que ele monta puder existir de verdade. Ver AP-301.

  it('renders time schedule pills', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
      time_schedule: ['08:00', '12:00', '20:00'],
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('12:00')).toBeInTheDocument()
    expect(screen.getByText('20:00')).toBeInTheDocument()
  })

  it('renders correct dosage text for single pill', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('1 un.')).toBeInTheDocument()
  })

  it('renders correct dosage text for multiple pills', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 2,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('2 un.')).toBeInTheDocument()
  })
})
