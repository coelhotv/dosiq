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

// 053: DOSAGE_UNIT_LABELS NUNCA mockado — vem do módulo real (importActual) para que a grafia
// canônica (mL) do formatador central nunca divirja silenciosamente do mock (AP-306).
vi.mock('@schemas/medicineSchema', async () => {
  const actual = await vi.importActual('@schemas/medicineSchema')
  return {
    ...actual,
    DOSAGE_UNITS: ['mg', 'mcg', 'g', 'ml', 'ui', 'gotas'],
    PRESENTATIONS: ['comprimido', 'capsula', 'liquido', 'injetavel'],
    PRESENTATION_LABELS: {
      comprimido: 'Comprimido',
      capsula: 'Cápsula',
      liquido: 'Líquido',
      injetavel: 'Injetável',
    },
    LIQUID_PRESENTATIONS: ['liquido', 'injetavel'],
    REGULATORY_CATEGORIES: ['Genérico', 'Similar', 'Novo'],
    REGULATORY_CATEGORY_LABELS: {
      Genérico: 'Genérico',
      Similar: 'Similar',
      Novo: 'Novo',
    },
    normalizeRegulatoryCategory: (v) => v || null,
  }
})

vi.mock('@schemas/protocolSchema', () => ({
  FREQUENCIES: ['diario', 'semanal', 'quando_necessario'],
  FREQUENCY_LABELS: {
    diario: 'Diário',
    semanal: 'Semanal',
    quando_necessario: 'Quando necessário',
  },
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

import TreatmentWizard from '@/features/protocols/components/TreatmentWizard'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'

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
    expect(
      screen.getByPlaceholderText('Ex: Losartana ou busque na base ANVISA...')
    ).toBeInTheDocument()
  })

  it('inicia no step 1 pré-preenchido quando preselectedMedicine fornecido', () => {
    // Medicamento da busca ANVISA é novo (não está em medicines): deve começar no
    // passo 1 com os dados pré-preenchidos, para o usuário definir concentração,
    // unidade, apresentação e TTL (campos que a base ANVISA não fornece).
    const med = {
      name: 'Losartana',
      type: 'medicamento',
      laboratory: 'EMS',
      active_ingredient: 'Losartana Potássica',
      regulatory_category: 'Genérico',
    }
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} preselectedMedicine={med} />)

    expect(screen.getByRole('heading', { name: 'Medicamento' })).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Losartana')).toBeInTheDocument()
    expect(screen.getByDisplayValue('EMS')).toBeInTheDocument()
  })

  it('valida campos obrigatorios no step 1', () => {
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    const nextBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo'))
    expect(nextBtn).toBeDisabled()
  })

  it('habilita Proximo quando campos preenchidos', () => {
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Ex: Losartana ou busque na base ANVISA...'), {
      target: { value: 'Losartana' },
    })
    fireEvent.change(screen.getByPlaceholderText('50'), { target: { value: '50' } })

    const nextBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo'))
    expect(nextBtn).not.toBeDisabled()
  })

  it('avanca para step 2 ao clicar Proximo', () => {
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Ex: Losartana ou busque na base ANVISA...'), {
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

    // preselected agora inicia no passo 1 (prefilled válido) → avança p/ o passo 2
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo')))
    fireEvent.click(screen.getByText('+ Adicionar horário'))

    const removeButtons = screen.getAllByText('✕')
    expect(removeButtons.length).toBe(2)

    fireEvent.click(removeButtons[0])
    expect(screen.queryAllByText('✕').length).toBe(0)
  })

  it('mostra toggle e select quando ha medicamentos cadastrados', () => {
    vi.mocked(useDashboard).mockReturnValue({
      refresh: vi.fn(),
      medicines: [{ id: 'm1', name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' }],
    })

    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('Já cadastrado')).toBeInTheDocument()
    expect(screen.getByText('Novo medicamento')).toBeInTheDocument()
  })

  it('modo existente mostra select de medicamentos', () => {
    vi.mocked(useDashboard).mockReturnValue({
      refresh: vi.fn(),
      medicines: [{ id: 'm1', name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' }],
    })

    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByText('Já cadastrado'))
    expect(screen.getByText('Losartana 50 mg')).toBeInTheDocument()
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

    // preselected agora inicia no passo 1 (prefilled válido) → avança p/ o passo 2
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo')))
    fireEvent.click(screen.getByText('Pular'))

    await waitFor(() => {
      expect(screen.getByText('Pronto!')).toBeInTheDocument()
    })
  })
})
