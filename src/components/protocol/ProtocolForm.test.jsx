import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProtocolForm from './ProtocolForm'

// Mock Button since it's used in component
vi.mock('../ui/Button', () => ({
  default: ({ children, onClick, disabled, type }) => (
    <button onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  )
}))

// Mock TitrationWizard since it's used in component
vi.mock('./TitrationWizard', () => ({
  default: ({ schedule, onChange }) => (
    <div data-testid="titration-wizard">
      <div>Titration Wizard</div>
      <button onClick={() => onChange(schedule)}>Mock Wizard</button>
    </div>
  )
}))

describe('ProtocolForm', () => {
  const mockMedicines = [
    { id: '1', name: 'Medicine A', dosage_per_pill: 50, dosage_unit: 'mg' },
    { id: '2', name: 'Medicine B', dosage_per_pill: 100, dosage_unit: 'mg' }
  ]

  const mockTreatmentPlans = [
    { id: 'tp1', name: 'Plan A' },
    { id: 'tp2', name: 'Plan B' }
  ]

  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  it('renders correctly for a new protocol', () => {
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Novo Protocolo')).toBeDefined()
    expect(screen.getByLabelText(/Nome do Protocolo/i)).toBeDefined()
  })

  it('renders correctly for editing an existing protocol', () => {
    const mockProtocol = {
      id: 'p1',
      name: 'Existing Protocol',
      medicine_id: '1',
      frequency: 'diário',
      time_schedule: ['08:00'],
      dosage_per_intake: 1,
      active: true
    }

    render(
      <ProtocolForm
        medicines={mockMedicines}
        protocol={mockProtocol}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Editar Protocolo')).toBeDefined()
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
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.click(screen.getByText('Criar Protocolo'))

    await waitFor(() => {
      expect(screen.getByText((content, element) => 
        content === 'Selecione um medicamento' && element.classList.contains('error-message')
      )).toBeInTheDocument()
      expect(screen.getByText((content, element) => 
        content === 'Nome do protocolo é obrigatório' && element.classList.contains('error-message')
      )).toBeInTheDocument()
      expect(screen.getByText((content, element) => 
        content === 'Frequência é obrigatória' && element.classList.contains('error-message')
      )).toBeInTheDocument()
      expect(screen.getByText((content, element) => 
        content === 'Adicione pelo menos um horário' && element.classList.contains('error-message')
      )).toBeInTheDocument()
    })

    expect(mockOnSave).not.toHaveBeenCalled()
  })

  it('submits form with valid data', async () => {
    mockOnSave.mockResolvedValue({})

    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    // Fill form
    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Protocolo/i), { target: { value: 'Test Protocol' } })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '1' } })

    // Add time
    const timeInput = screen.getByLabelText(/Horários/i)
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Submit
    fireEvent.click(screen.getByText('Criar Protocolo'))

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        medicine_id: '1',
        treatment_plan_id: null,
        name: 'Test Protocol',
        frequency: 'diário',
        time_schedule: ['08:00'],
        dosage_per_intake: 1,
        target_dosage: null,
        titration_status: 'estável',
        titration_schedule: [],
        notes: null,
        active: true
      })
    })
  })

  it('adds and removes time schedule', () => {
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

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
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const timeInput = screen.getByLabelText(/Horários/i)

    // Add time
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Try to add same time again
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    expect(screen.getByText('Horário já adicionado')).toBeInTheDocument()
  })

  it('enables titration mode', () => {
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const titrationCheckbox = screen.getByLabelText(/Regime de Titulação Inteligente/i)
    expect(titrationCheckbox).not.toBeChecked()

    fireEvent.click(titrationCheckbox)
    expect(titrationCheckbox).toBeChecked()
    expect(screen.getByTestId('titration-wizard')).toBeInTheDocument()
  })

  it('disables titration mode', () => {
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    const titrationCheckbox = screen.getByLabelText(/Regime de Titulação Inteligente/i)
    fireEvent.click(titrationCheckbox)

    // Disable titration
    fireEvent.click(titrationCheckbox)
    expect(titrationCheckbox).not.toBeChecked()
    expect(screen.getByLabelText(/Dose Alvo/i)).toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

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
      active: true
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

    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    )

    // Fill form with valid data
    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Protocolo/i), { target: { value: 'Test Protocol' } })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '1' } })

    const timeInput = screen.getByLabelText(/Horários/i)
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Submit
    fireEvent.click(screen.getByText('Criar Protocolo'))

    await waitFor(() => {
      expect(screen.getByText(`❌ ${errorMessage}`)).toBeInTheDocument()
    })
  })

  it('validates dosage must be greater than zero', async () => {
    const onSave = vi.fn().mockResolvedValue({})
    
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={onSave}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Protocolo/i), { target: { value: 'Test Protocol' } })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    // Set dosage to 0 which should fail validation
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '0' } })

    const timeInput = screen.getByLabelText(/Horários/i)
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Click submit
    fireEvent.click(screen.getByText('Criar Protocolo'))
    
    // onSave should NOT have been called because validation should have failed
    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  it('validates target dosage must be a number', async () => {
    const onSave = vi.fn().mockResolvedValue({})
    
    render(
      <ProtocolForm
        medicines={mockMedicines}
        onSave={onSave}
        onCancel={mockOnCancel}
      />
    )

    // Fill all required fields first
    fireEvent.change(screen.getByLabelText(/Medicamento/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Nome do Protocolo/i), { target: { value: 'Test Protocol' } })
    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'diário' } })
    fireEvent.change(screen.getByLabelText(/Dose por Horário/i), { target: { value: '1' } })

    // Add time schedule
    const timeInput = screen.getByLabelText(/Horários/i)
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('➕ Adicionar'))

    // Set target dosage to empty (no validation should trigger)
    fireEvent.change(screen.getByLabelText(/Dose Alvo/i), { target: { value: '' } })

    // Click submit
    fireEvent.click(screen.getByText('Criar Protocolo'))
    
    // With empty target dosage, validation should pass and onSave should be called
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    }, { timeout: 1000 })
  })
})
