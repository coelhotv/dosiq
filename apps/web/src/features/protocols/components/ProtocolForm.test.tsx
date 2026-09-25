import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProtocolForm from './ProtocolForm'

// 085 C2: trava por usuária da cadência "a cada N dias" — controlada por teste, sem rede.
const cadence = vi.hoisted(() => ({ available: false }))
vi.mock('../hooks/useIntervalCadenceAvailability', () => ({
  useIntervalCadenceAvailability: () => cadence.available,
}))

// Mock Button since it's used in component
vi.mock('../ui/Button', () => ({
  default: ({ children, onClick, disabled, type }) => (
    <button onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  ),
}))

describe('ProtocolForm', () => {
  const mockMedicines = [
    { id: '1', name: 'Medicine A', dosage_per_pill: 50, dosage_unit: 'mg' },
    { id: '2', name: 'Medicine B', dosage_per_pill: 100, dosage_unit: 'mg' },
  ]

  const mockTreatmentPlans = [
    { id: 'tp1', name: 'Plan A' },
    { id: 'tp2', name: 'Plan B' },
  ]

  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  it('renders correctly for a new protocol', () => {
    render(<ProtocolForm medicines={mockMedicines} onSave={mockOnSave} onCancel={mockOnCancel} />)

    expect(screen.getByText('Novo Tratamento')).toBeDefined()
    expect(screen.getByLabelText(/Nome do Tratamento/i)).toBeDefined()
  })

  it('renders correctly for editing an existing protocol', () => {
    const mockProtocol = {
      id: 'p1',
      name: 'Existing Protocol',
      medicine_id: '1',
      frequency: 'diário',
      time_schedule: ['08:00'],
      dosage_per_intake: 1,
      active: true,
    }

    render(
      <ProtocolForm
        medicines={mockMedicines}
        protocol={mockProtocol}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Editar Tratamento')).toBeDefined()
  })

  it('renders with treatment plans', () => {
    render(
      <ProtocolForm
        medicines={mockMedicines}
        treatmentPlans={mockTreatmentPlans}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByLabelText(/Plano de Tratamento/i)).toBeDefined()
    expect(screen.getByText('Plan A')).toBeInTheDocument()
    expect(screen.getByText('Plan B')).toBeInTheDocument()
  })

  it('validates required fields on submit', async () => {
    render(<ProtocolForm medicines={mockMedicines} onSave={mockOnSave} onCancel={mockOnCancel} />)

    fireEvent.click(screen.getByText('Criar Tratamento'))

    await waitFor(() => {
      expect(
        screen.getByText(
          (content, element) =>
            content === 'Selecione um medicamento' && element.classList.contains('error-message')
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          (content, element) =>
            content === 'Nome do tratamento é obrigatório' &&
            element.classList.contains('error-message')
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          (content, element) =>
            content === 'Adicione pelo menos um horário' &&
            element.classList.contains('error-message')
        )
      ).toBeInTheDocument()
    })

    expect(mockOnSave).not.toHaveBeenCalled()
  })

  it('submits form with valid data', async () => {
    mockOnSave.mockResolvedValue({})

    render(<ProtocolForm medicines={mockMedicines} onSave={mockOnSave} onCancel={mockOnCancel} />)

    // Fill form
    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Tratamento/i), {
      target: { value: 'Test Protocol' },
    })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '1' } })

    // Add time
    const timeInput = screen.getByLabelText(/Horários/i)
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Submit
    fireEvent.click(screen.getByText('Criar Tratamento'))

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        medicine_id: '1',
        treatment_plan_id: null,
        name: 'Test Protocol',
        frequency: 'diário',
        time_schedule: ['08:00'],
        dosage_per_intake: 1,
        target_dosage: null,
        notes: null,
        active: true,
        start_date: expect.any(String),
        end_date: null,
        intake_unit: null,
        interval_days: null,
        weekdays: [],
      })
    })
  })

  it('adds and removes time schedule', () => {
    render(<ProtocolForm medicines={mockMedicines} onSave={mockOnSave} onCancel={mockOnCancel} />)

    const timeInput = screen.getByLabelText(/Horários/i)

    // Add time
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))
    expect(screen.getByText('08:00')).toBeInTheDocument()

    // Add another time
    fireEvent.change(timeInput, { target: { value: '12:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))
    expect(screen.getByText('12:00')).toBeInTheDocument()

    // Remove time
    fireEvent.click(screen.getAllByText('✕')[0])
    expect(screen.queryByText('08:00')).not.toBeInTheDocument()
  })

  it('prevents duplicate time schedule', () => {
    render(<ProtocolForm medicines={mockMedicines} onSave={mockOnSave} onCancel={mockOnCancel} />)

    const timeInput = screen.getByLabelText(/Horários/i)

    // Add time
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Try to add same time again
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    expect(screen.getByText('Horário já adicionado')).toBeInTheDocument()
  })

  // ── 029 F3.1 (T017i): WEB WRITE-FREEZE ────────────────────────────────────────
  // Substituem 'enables/disables titration mode', que exercitavam a FÁBRICA DE ZUMBI: o
  // checkbox + wizard + select "Status Manual" marcavam `titulando` sem NUNCA setar
  // `stage_started_at`, o relógio que faz a escada andar (AP-301). A escada nasce no app.
  it('não oferece nenhuma superfície de escrita de titulação', () => {
    render(<ProtocolForm medicines={mockMedicines} onSave={mockOnSave} onCancel={mockOnCancel} />)

    expect(screen.queryByLabelText(/Regime de Titulação Inteligente/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('titration-wizard')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Status Manual/i)).not.toBeInTheDocument()
    // A leitura e a dose alvo continuam; o encaminhamento p/ o app aparece.
    expect(screen.getByLabelText(/Dose Alvo/i)).toBeInTheDocument()
    expect(screen.getByText(/Gerencie a evolução do tratamento no aplicativo/i)).toBeInTheDocument()
  })

  it('🔴 editar tratamento pela web NÃO consegue produzir titulação (guard do AP-301)', async () => {
    mockOnSave.mockResolvedValue({})
    const emTitulacao = {
      id: 'p1',
      name: 'Existing Protocol',
      medicine_id: '1',
      frequency: 'diário',
      time_schedule: ['08:00'],
      dosage_per_intake: 1,
      active: true,
      // Estado N1 herdado (as colunas caem no F6): a web não pode propagá-lo de volta.
      titration_status: 'titulando',
      titration_schedule: [{ dosage: 1, duration_days: 7 }],
    }

    render(
      <ProtocolForm
        medicines={mockMedicines}
        protocol={emTitulacao}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )
    fireEvent.click(screen.getByText('Atualizar'))

    await waitFor(() => expect(mockOnSave).toHaveBeenCalled())
    const payload = mockOnSave.mock.calls[0][0]
    expect(payload).not.toHaveProperty('titration_status')
    expect(payload).not.toHaveProperty('titration_schedule')
    expect(JSON.stringify(payload)).not.toContain('titulando')
  })

  it('calls onCancel when cancel button is clicked', () => {
    render(<ProtocolForm medicines={mockMedicines} onSave={mockOnSave} onCancel={mockOnCancel} />)

    fireEvent.click(screen.getByText('Cancelar'))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('disables medicine select when editing', () => {
    const mockProtocol = {
      id: 'p1',
      name: 'Existing Protocol',
      medicine_id: '1',
      frequency: 'diário',
      time_schedule: ['08:00'],
      dosage_per_intake: 1,
      active: true,
    }

    render(
      <ProtocolForm
        medicines={mockMedicines}
        protocol={mockProtocol}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const medicineSelect = screen.getByLabelText(/Medicamento/i)
    expect(medicineSelect).toBeDisabled()
  })

  it('handles submit error', async () => {
    const errorMessage = 'Erro ao salvar'
    mockOnSave.mockRejectedValue(new Error(errorMessage))

    render(<ProtocolForm medicines={mockMedicines} onSave={mockOnSave} onCancel={mockOnCancel} />)

    // Fill form with valid data
    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Tratamento/i), {
      target: { value: 'Test Protocol' },
    })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '1' } })

    const timeInput = screen.getByLabelText(/Horários/i)
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Submit
    fireEvent.click(screen.getByText('Criar Tratamento'))

    await waitFor(() => {
      expect(screen.getByText(`❌ ${errorMessage}`)).toBeInTheDocument()
    })
  })

  it('validates dosage must be greater than zero', async () => {
    const onSave = vi.fn().mockResolvedValue({})

    render(<ProtocolForm medicines={mockMedicines} onSave={onSave} onCancel={mockOnCancel} />)

    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Tratamento/i), {
      target: { value: 'Test Protocol' },
    })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    // Set dosage to 0 which should fail validation
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '0' } })

    const timeInput = screen.getByLabelText(/Horários/i)
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Click submit
    fireEvent.click(screen.getByText('Criar Tratamento'))

    // onSave should NOT have been called because validation should have failed
    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  it('validates target dosage must be a number', async () => {
    const onSave = vi.fn().mockResolvedValue({})

    render(<ProtocolForm medicines={mockMedicines} onSave={onSave} onCancel={mockOnCancel} />)

    // Fill all required fields first
    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Tratamento/i), {
      target: { value: 'Test Protocol' },
    })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '1' } })

    // Add time schedule
    const timeInput = screen.getByLabelText(/Horários/i)
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Set target dosage to empty (no validation should trigger)
    fireEvent.change(screen.getByLabelText(/Dose Alvo/i), { target: { value: '' } })

    // Click submit
    fireEvent.click(screen.getByText('Criar Tratamento'))

    // With empty target dosage, validation should pass and onSave should be called
    await waitFor(
      () => {
        expect(onSave).toHaveBeenCalled()
      },
      { timeout: 1000 }
    )
  })
})

describe('ProtocolForm — cadência "a cada N dias" (085 C2)', () => {
  const medicines = [{ id: '1', name: 'Medicine A', dosage_per_pill: 50, dosage_unit: 'mg' }]
  const onSave = vi.fn()

  afterEach(() => {
    cadence.available = false
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  function optionValues() {
    return Array.from((screen.getByLabelText(/Frequência/i) as HTMLSelectElement).options).map((o) => o.value)
  }

  function fillBase() {
    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Tratamento/i), { target: { value: 'Injetável' } })
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Horários/i), { target: { value: '09:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))
  }

  it('trava fechada ⇒ a opção não aparece', () => {
    render(<ProtocolForm medicines={medicines} onSave={onSave} onCancel={vi.fn()} />)
    expect(optionValues()).not.toContain('intervalo_dias')
  })

  it('trava aberta ⇒ opção aparece, campo N surge e N=30 vai no payload', async () => {
    cadence.available = true
    onSave.mockResolvedValue({})
    render(<ProtocolForm medicines={medicines} onSave={onSave} onCancel={vi.fn()} />)
    expect(optionValues()).toContain('intervalo_dias')
    expect(screen.queryByLabelText(/A cada quantos dias/i)).toBeNull()

    fillBase()
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'intervalo_dias' } })
    fireEvent.change(screen.getByLabelText(/A cada quantos dias/i), { target: { value: '30' } })
    fireEvent.click(screen.getByText('Criar Tratamento'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 'intervalo_dias', interval_days: 30, weekdays: [] })
      )
    })
  })

  it('FM-9/FM-7: N vazio ou fora da faixa bloqueia com mensagem em PT', async () => {
    cadence.available = true
    render(<ProtocolForm medicines={medicines} onSave={onSave} onCancel={vi.fn()} />)
    fillBase()
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'intervalo_dias' } })
    fireEvent.click(screen.getByText('Criar Tratamento'))
    expect(await screen.findByText(/Informe a cada quantos dias/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/A cada quantos dias/i), { target: { value: '181' } })
    fireEvent.click(screen.getByText('Criar Tratamento'))
    expect(await screen.findByText(/Escolha de 2 a 180 dias/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('FM-8: trocar de intervalo_dias para diário não leva o N', async () => {
    cadence.available = true
    onSave.mockResolvedValue({})
    render(<ProtocolForm medicines={medicines} onSave={onSave} onCancel={vi.fn()} />)
    fillBase()
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'intervalo_dias' } })
    fireEvent.change(screen.getByLabelText(/A cada quantos dias/i), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    fireEvent.click(screen.getByText('Criar Tratamento'))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'diário', interval_days: null }))
    })
  })

  it('FM-4: edição de tratamento intervalo_dias com trava fechada mantém opção e N', () => {
    const protocol = {
      id: 'p1', medicine_id: '1', name: 'Depo', frequency: 'intervalo_dias', interval_days: 90,
      time_schedule: ['09:00'], dosage_per_intake: 1, active: true, start_date: '2026-09-01', weekdays: [],
    }
    render(<ProtocolForm medicines={medicines} protocol={protocol} onSave={onSave} onCancel={vi.fn()} />)
    expect((screen.getByLabelText(/Frequência/i) as HTMLSelectElement).value).toBe('intervalo_dias')
    expect((screen.getByLabelText(/A cada quantos dias/i) as HTMLInputElement).value).toBe('90')
  })
})
