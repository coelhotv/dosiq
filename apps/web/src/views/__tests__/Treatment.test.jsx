import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock useDashboard
vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: vi.fn(() => ({
    medicines: [],
    protocols: [],
    logs: [],
    refresh: vi.fn(),
  })),
}))

// Mock useComplexityMode
vi.mock('@dashboard/hooks/useComplexityMode', () => ({
  useComplexityMode: vi.fn(() => ({
    mode: 'moderate',
    isComplex: false,
    ringGaugeSize: 'medium',
    defaultViewMode: 'time',
  })),
}))

// Mock useCachedQuery
vi.mock('@shared/hooks/useCachedQuery', () => ({
  useCachedQuery: vi.fn(() => ({ data: [] })),
}))

// Mock useTreatmentList
// Mock useTreatmentList
vi.mock('@protocols/hooks/useTreatmentList', () => ({
  useTreatmentList: vi.fn(() => ({
    activeItems: [],
    pausedItems: [],
    finishedItems: [],
    activeGroups: [],
    pausedGroups: [],
    finishedGroups: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

// Mock services
vi.mock('@shared/services', () => ({
  protocolService: { update: vi.fn(), delete: vi.fn() },
  medicineService: { getAll: vi.fn(() => Promise.resolve([])) },
  treatmentPlanService: { 
    getAll: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
    getById: vi.fn(() => Promise.resolve({}))
  },
}))



// Mock emergency service
vi.mock('@features/emergency/services/emergencyCardService', () => {
  const service = {
    load: vi.fn(() => Promise.resolve({ success: true, data: null })),
    save: vi.fn(),
  }
  return {
    emergencyCardService: service,
    default: service,
  }
})

// Mock UI components
vi.mock('@shared/components/ui/Modal', () => ({
  default: ({ children, isOpen }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}))

vi.mock('@shared/components/ui/Loading', () => ({
  default: () => <div data-testid="loading">Loading...</div>,
}))

vi.mock('@protocols/components/TreatmentWizard', () => ({
  default: ({ onCancel }) => (
    <div data-testid="treatment-wizard">
      <button onClick={onCancel}>Cancelar</button>
    </div>
  ),
}))

// Mock Suspense
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    Suspense: ({ children }) => children,
  }
})

import Treatment from '@/views/redesign/Treatments'
import { useTreatmentList } from '@protocols/hooks/useTreatmentList'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'

describe('Treatment', () => {
  const mockGroups = [
    {
      groupKey: 'plan:1',
      groupLabel: 'Plano 1',
      items: [
        { 
          id: '1', 
          medicineName: 'Dipirona', 
          concentrationLabel: '500mg', 
          intakeLabel: '1 cp',
          timeSchedule: ['08:00', '20:00'],
          frequencyLabel: '12/12h'
        }
      ]
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTreatmentList).mockReturnValue({
      activeItems: [],
      pausedItems: [],
      finishedItems: [],
      activeGroups: [],
      pausedGroups: [],
      finishedGroups: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza titulo e botao Novo', () => {
    render(<Treatment onNavigate={vi.fn()} />)

    expect(screen.getByText('Meus Tratamentos')).toBeInTheDocument()
    expect(screen.getByText(/Novo/i)).toBeInTheDocument()
  })

  it('renderiza empty state quando nao ha dados', () => {
    vi.mocked(useTreatmentList).mockReturnValue({
      activeItems: [],
      pausedItems: [],
      finishedItems: [],
      activeGroups: [],
      pausedGroups: [],
      finishedGroups: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<Treatment onNavigate={vi.fn()} />)

    expect(screen.getByText(/Nenhum tratamento ativo no momento/i)).toBeInTheDocument()
  })

  it('abre wizard ao clicar Novo', async () => {
    render(<Treatment onNavigate={vi.fn()} />)

    const novoBtn = screen.getByText(/Novo/i).closest('button')
    fireEvent.click(novoBtn)
    
    // Agora clica na opção de Tratamento no dropdown (que abre o wizard)
    const tratamentoBtn = screen.getByRole('menuitem', { name: /Tratamento/i })
    fireEvent.click(tratamentoBtn)
    
    expect(await screen.findByTestId('treatment-wizard')).toBeInTheDocument()
  })

  it('renderiza tratamentos no modo simples', () => {
    vi.mocked(useComplexityMode).mockReturnValue({ mode: 'simple' })
    vi.mocked(useTreatmentList).mockReturnValue({
      activeItems: mockGroups[0].items,
      pausedItems: [],
      finishedItems: [],
      activeGroups: [],
      pausedGroups: [],
      finishedGroups: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<Treatment onNavigate={vi.fn()} />)

    expect(screen.getAllByText('Dipirona')).toHaveLength(1)
    expect(screen.getByText('500mg')).toBeInTheDocument()
  })

  it('renderiza grupos no modo complexo', () => {
    useComplexityMode.mockReturnValue({ mode: 'complex' })
    
    const mockGroup = {
      groupKey: 'plan:1',
      groupLabel: 'Hipertensao',
      groupEmoji: '❤️',
      groupColor: '#ff0000',
      isPlan: true,
      items: [
        {
          id: 'p1',
          medicineName: 'Losartana',
          concentrationLabel: '50mg',
          intakeLabel: '1 comprimido',
          frequencyLabel: 'Diário',
          timeSchedule: ['08:00'],
          stockStatus: 'normal',
          daysRemaining: 30,
          adherenceScore7d: 100,
          active: true,
          tabStatus: 'ativo',
        }
      ]
    }

    vi.mocked(useTreatmentList).mockReturnValue({
      activeItems: mockGroup.items,
      pausedItems: [],
      finishedItems: [],
      activeGroups: [mockGroup],
      pausedGroups: [],
      finishedGroups: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<Treatment onNavigate={vi.fn()} />)
    expect(screen.getByText('Hipertensao')).toBeInTheDocument()
    expect(screen.getAllByText('Losartana')[0]).toBeInTheDocument()
  })
})
