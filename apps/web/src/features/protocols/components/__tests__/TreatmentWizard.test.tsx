import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: vi.fn(() => ({
    refresh: vi.fn(),
    medicines: [],
  })),
}))

// 085 C2: trava por usuária da cadência "a cada N dias" — controlada por teste, sem rede.
const cadence = vi.hoisted(() => ({ available: false }))
vi.mock('@/features/protocols/hooks/useIntervalCadenceAvailability', () => ({
  useIntervalCadenceAvailability: () => cadence.available,
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

// 085: o mock à mão (FREQUENCIES sem acento, sem os helpers) quebrou com o Slice A — o componente
// passou a importar `frequencyRequiresWeekdays`/`frequencyOptionsFor` e o mock não os tinha. O
// módulo é puro (constantes + Zod): usar o real mantém o teste acoplado ao vocabulário verdadeiro.

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
import { protocolService } from '@shared/services'

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

  it('085 C2: cadência por intervalo grava N e nasce com o nome certo', async () => {
    cadence.available = true
    vi.mocked(protocolService.create).mockResolvedValueOnce({ id: 'p1', interval_days: 30 } as never)
    const med = { id: 'm1', name: 'Depo', type: 'medicamento', dosage_per_pill: 150, dosage_unit: 'mg' }
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} preselectedMedicine={med} />)
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo')))

    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'intervalo_dias' } })
    const next = () => screen.getByText('Próximo →').closest('button')
    // N vazio: não avança
    expect(next()).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/A cada quantos dias/i), { target: { value: '181' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/2 a 180/)
    expect(next()).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/A cada quantos dias/i), { target: { value: '30' } })
    expect(next()).not.toBeDisabled()
    fireEvent.click(next())
    // passo 3 (estoque): pular cria o tratamento sem estoque
    fireEvent.click(screen.getByText('Pular'))

    await waitFor(() => expect(screen.getByText('Pronto!')).toBeInTheDocument())
    expect(protocolService.create).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'intervalo_dias', interval_days: 30, name: 'Depo - A cada 30 dias' })
    )
    expect(screen.getByText(/com tratamento a cada 30 dias/)).toBeInTheDocument()
    cadence.available = false
  })

  it('smoke C2: líquido criado pelo assistente grava a unidade de tomada que a tela mostra', async () => {
    vi.mocked(protocolService.create).mockResolvedValueOnce({ id: 'p2' } as never)
    const med = { id: 'm2', name: 'Mesigyna', type: 'medicamento', dosage_per_pill: 50, dosage_unit: 'mg/ml' }
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} preselectedMedicine={med} />)
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo')))
    fireEvent.change(screen.getByLabelText(/Unidade de tomada/i), { target: { value: 'ml' } })
    fireEvent.click(screen.getByText('Próximo →').closest('button'))
    fireEvent.click(screen.getByText('Pular'))
    await waitFor(() => expect(screen.getByText('Pronto!')).toBeInTheDocument())
    expect(protocolService.create).toHaveBeenCalledWith(expect.objectContaining({ intake_unit: 'ml' }))
  })

  it('smoke C2: sem tocar no seletor, grava o padrão exibido; sólido grava NULL', async () => {
    vi.mocked(protocolService.create).mockResolvedValueOnce({ id: 'p3' } as never)
    const med = { id: 'm3', name: 'Lantus', type: 'medicamento', dosage_per_pill: 100, dosage_unit: 'ui/ml' }
    const { unmount } = render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} preselectedMedicine={med} />)
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo')))
    fireEvent.change(screen.getByLabelText(/Unidade de tomada/i), { target: { value: 'UI' } })
    fireEvent.click(screen.getByText('Próximo →').closest('button'))
    fireEvent.click(screen.getByText('Pular'))
    await waitFor(() => expect(screen.getByText('Pronto!')).toBeInTheDocument())
    expect(protocolService.create).toHaveBeenLastCalledWith(expect.objectContaining({ intake_unit: 'UI' }))
    unmount()

    vi.mocked(protocolService.create).mockResolvedValueOnce({ id: 'p4' } as never)
    const pill = { id: 'm4', name: 'Losartana', type: 'medicamento', dosage_per_pill: 50, dosage_unit: 'mg' }
    render(<TreatmentWizard onComplete={vi.fn()} onCancel={vi.fn()} preselectedMedicine={pill} />)
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes('Próximo')))
    fireEvent.click(screen.getByText('Próximo →').closest('button'))
    fireEvent.click(screen.getByText('Pular'))
    await waitFor(() => expect(screen.getByText('Pronto!')).toBeInTheDocument())
    expect(protocolService.create).toHaveBeenLastCalledWith(expect.objectContaining({ intake_unit: null }))
  })
})
