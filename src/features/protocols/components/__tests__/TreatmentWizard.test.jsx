import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: vi.fn(() => ({
    refresh: vi.fn(),
    medicines: [],
  })),
}))

vi.mock('@shared/services', () => ({
  medicineService: {
    create: vi.fn(() => Promise.resolve({ id: 'm1', name: 'Losartana' })),
  },
  protocolService: {
    create: vi.fn(() => Promise.resolve({ id: 'p1' })),
  },
  stockService: {
    create: vi.fn(() => Promise.resolve({ id: 's1' })),
  },
}))

vi.mock('@schemas/medicineSchema', () => ({
  DOSAGE_UNITS: ['mg', 'mcg', 'g'],
}))

vi.mock('@schemas/protocolSchema', () => ({
  FREQUENCIES: ['diario', 'semanal', 'quando_necessario'],
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
      const filteredProps = {}
      Object.keys(props).forEach((key) => {
        if (!['custom', 'variants', 'initial', 'animate', 'exit', 'transition'].includes(key)) {
          filteredProps[key] = props[key]
        }
      })
      return <div {...filteredProps}>{children}</div>
    },
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}))

import TreatmentWizard from '../TreatmentWizard'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'

describe('TreatmentWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza step 1 (Medicamento) por padrao', () => {
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Medicamento' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ex: Losartana')).toBeInTheDocument()
  })

  it('renderiza step 2 quando preselectedMedicine fornecido', () => {
    const med = {
      id: 'm1',
      name: 'Losartana',
      type: 'medicamento',
      dosage_per_pill: 50,
      dosage_unit: 'mg',
    }
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} preselectedMedicine={med} />)

    expect(screen.getByText('Como Tomar')).toBeInTheDocument()
  })

  it('valida campos obrigatorios no step 1', () => {
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    const nextBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo'))
    expect(nextBtn).toBeDisabled()
  })

  it('habilita Proximo quando campos preenchidos', () => {
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Ex: Losartana'), {
      target: { value: 'Losartana' },
    })
    fireEvent.change(screen.getByPlaceholderText('50'), { target: { value: '50' } })

    const nextBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo'))
    expect(nextBtn).not.toBeDisabled()
  })

  it('avanca para step 2 ao clicar Proximo', () => {
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Ex: Losartana'), {
      target: { value: 'Losartana' },
    })
    fireEvent.change(screen.getByPlaceholderText('50'), { target: { value: '50' } })

    const nextBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo'))
    fireEvent.click(nextBtn)

    expect(screen.getByText('Como Tomar')).toBeInTheDocument()
  })

  it('chama onCancel ao clicar Cancelar', () => {
    const onCancel = vi.fn()
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('mostra progress dots 1/3 no step 1', () => {
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('permite adicionar e remover horarios no step 2', () => {
    const med = {
      id: 'm1',
      name: 'Test',
      type: 'medicamento',
      dosage_per_pill: 50,
      dosage_unit: 'mg',
    }
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} preselectedMedicine={med} />)

    fireEvent.click(screen.getByText('+ Adicionar horário'))

    const removeButtons = screen.getAllByText('✕')
    expect(removeButtons.length).toBe(2)

    fireEvent.click(removeButtons[0])
    expect(screen.queryAllByText('✕').length).toBe(0)
  })

  it('mostra toggle e select quando ha medicamentos cadastrados', () => {
    useDashboard.mockReturnValue({
      refresh: vi.fn(),
      medicines: [{ id: 'm1', name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' }],
    })

    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('Já cadastrado')).toBeInTheDocument()
    expect(screen.getByText('Novo medicamento')).toBeInTheDocument()
  })

  it('modo existente mostra select de medicamentos', () => {
    useDashboard.mockReturnValue({
      refresh: vi.fn(),
      medicines: [{ id: 'm1', name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' }],
    })

    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByText('Já cadastrado'))
    expect(screen.getByText('Losartana 50mg')).toBeInTheDocument()
  })

  it('submete com Pular no step 2 (skip stock)', async () => {
    const onComplete = vi.fn()
    const med = {
      id: 'm1',
      name: 'Test',
      type: 'medicamento',
      dosage_per_pill: 50,
      dosage_unit: 'mg',
    }
    render(<TreatmentWizard onComplete={onComplete} onCancel={vi.fn()} preselectedMedicine={med} />)

    fireEvent.click(screen.getByText('Pular'))

    await waitFor(() => {
      expect(screen.getByText('Pronto!')).toBeInTheDocument()
    })
  })
})
