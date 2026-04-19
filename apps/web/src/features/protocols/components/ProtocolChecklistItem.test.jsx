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
    expect(screen.getByText('1 comp.')).toBeInTheDocument()
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

  it('renders titration scheduler data when present', () => {
    const protocol = {
      id: 'p1',
      name: 'Manhã',
      dosage_per_intake: 1,
      active: true,
      medicine_id: 'm1',
      medicine: { name: 'Aspirina' },
      titration_scheduler_data: {
        currentStep: 2,
        totalSteps: 5,
        day: 10,
        totalDays: 30,
        progressPercent: 33,
      },
    }
    const onToggle = vi.fn()

    render(<ProtocolChecklistItem protocol={protocol} isSelected={false} onToggle={onToggle} />)

    expect(screen.getByText('Etapa 2/5')).toBeInTheDocument()
    expect(screen.getByText('Dia 10/30')).toBeInTheDocument()
  })

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

    expect(screen.getByText('1 comp.')).toBeInTheDocument()
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

    expect(screen.getByText('2 comps.')).toBeInTheDocument()
  })
})
