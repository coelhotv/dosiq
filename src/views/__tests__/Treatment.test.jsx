import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: vi.fn(() => ({
    medicines: [],
    protocols: [],
    refresh: vi.fn(),
  })),
}))

vi.mock('@shared/hooks/useCachedQuery', () => ({
  useCachedQuery: vi.fn(() => ({ data: [] })),
}))

vi.mock('@shared/services', () => ({
  protocolService: { update: vi.fn() },
}))

vi.mock('@protocols/services/treatmentPlanService', () => ({
  treatmentPlanService: { getAll: vi.fn() },
}))

import Treatment from '../Treatment'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'

describe('Treatment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza titulo e botao Novo', () => {
    render(<Treatment onNavigate={vi.fn()} />)

    expect(screen.getByText('Meu Tratamento')).toBeInTheDocument()
    expect(screen.getByText('+ Novo')).toBeInTheDocument()
  })

  it('renderiza empty state quando nao ha dados', () => {
    render(<Treatment onNavigate={vi.fn()} />)

    expect(screen.getByText('Nenhum tratamento cadastrado')).toBeInTheDocument()
    expect(screen.getByText('Cadastrar primeiro medicamento')).toBeInTheDocument()
  })

  it('navega para medicines ao clicar Novo', () => {
    const onNavigate = vi.fn()
    render(<Treatment onNavigate={onNavigate} />)

    fireEvent.click(screen.getByText('+ Novo'))
    expect(onNavigate).toHaveBeenCalledWith('medicines')
  })

  it('renderiza protocolos avulsos', () => {
    useDashboard.mockReturnValue({
      medicines: [{ id: 'm1', name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' }],
      protocols: [{
        id: 'p1',
        active: true,
        treatment_plan_id: null,
        medicine_id: 'm1',
        medicine: { name: 'Losartana' },
        frequency: 'diario',
        time_schedule: ['08:00'],
        dosage_per_intake: 1,
      }],
      refresh: vi.fn(),
    })

    render(<Treatment onNavigate={vi.fn()} />)

    expect(screen.getByText('Losartana')).toBeInTheDocument()
  })

  it('renderiza medicamentos sem protocolo com CTA', () => {
    useDashboard.mockReturnValue({
      medicines: [{ id: 'm1', name: 'Vitamina D', dosage_per_pill: 1000, dosage_unit: 'ui', type: 'suplemento' }],
      protocols: [],
      refresh: vi.fn(),
    })

    render(<Treatment onNavigate={vi.fn()} />)

    expect(screen.getByText('Vitamina D')).toBeInTheDocument()
  })

  it('renderiza planos de tratamento com protocolos ativos', () => {
    useDashboard.mockReturnValue({
      medicines: [{ id: 'm1', name: 'Losartana' }],
      protocols: [{
        id: 'p1',
        active: true,
        treatment_plan_id: 'tp1',
        medicine_id: 'm1',
        medicine: { name: 'Losartana' },
        frequency: 'diario',
        time_schedule: ['08:00'],
        dosage_per_intake: 1,
      }],
      refresh: vi.fn(),
    })

    useCachedQuery.mockReturnValue({
      data: [{
        id: 'tp1',
        name: 'Hipertensao',
        emoji: '❤️',
        protocols: [{
          id: 'p1',
          active: true,
          medicine: { name: 'Losartana' },
          frequency: 'diario',
          time_schedule: ['08:00'],
          dosage_per_intake: 1,
        }],
      }],
    })

    render(<Treatment onNavigate={vi.fn()} />)

    expect(screen.getByText('Hipertensao')).toBeInTheDocument()
  })
})
