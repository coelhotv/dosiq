import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LogForm from '../LogForm'

// Mock Button component
vi.mock('../../ui/Button', () => ({
  default: ({ children, onClick, type, disabled, variant }) => (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={`btn btn-${variant || 'primary'}`}
    >
      {children}
    </button>
  ),
}))

// Mock ProtocolChecklistItem
vi.mock('../../protocol/ProtocolChecklistItem', () => ({
  default: ({ protocol, isSelected, onToggle }) => (
    <div
      data-testid={`protocol-item-${protocol.id}`}
      className={isSelected ? 'selected' : ''}
      onClick={() => onToggle(protocol.id)}
    >
      {protocol.name}
    </div>
  ),
}))

describe('LogForm', () => {
  const mockProtocols = [
    {
      id: 'proto-1',
      name: 'Dipirona 3x ao dia',
      medicine_id: 'med-1',
      medicine: { id: 'med-1', name: 'Dipirona' },
      dosage_per_intake: 1,
      time_schedule: ['08:00', '14:00', '20:00'],
      active: true,
    },
    {
      id: 'proto-2',
      name: 'Paracetamol 2x ao dia',
      medicine_id: 'med-2',
      medicine: { id: 'med-2', name: 'Paracetamol' },
      dosage_per_intake: 2,
      time_schedule: ['08:00', '20:00'],
      active: true,
    },
  ]

  const mockTreatmentPlans = [
    {
      id: 'plan-1',
      name: 'Tratamento Completo',
      protocols: [
        { ...mockProtocols[0], active: true },
        { ...mockProtocols[1], active: true },
      ],
    },
  ]

  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render form with title', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText('Registrar Medicamento Tomado')).toBeInTheDocument()
    })

    it('should render protocol type toggle buttons', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText('💊 Único Remédio')).toBeInTheDocument()
      expect(screen.getByText('📁 Plano Completo')).toBeInTheDocument()
    })

    it('should disable plan button when no treatment plans', () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={[]}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const planButton = screen.getByText('📁 Plano Completo')
      expect(planButton).toBeDisabled()
    })

    it('should render datetime-local input', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/Data e Hora do Registro/i)).toBeInTheDocument()
    })

    it('should render protocol select when type is protocol', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/Protocolo/i)).toBeInTheDocument()
    })

    it('should render notes textarea', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/Observações/i)).toBeInTheDocument()
    })

    it('should render cancel and submit buttons', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText('Cancelar')).toBeInTheDocument()
      expect(screen.getByText('✅ Registrar Dose')).toBeInTheDocument()
    })
  })

  describe('form type switching', () => {
    it('should switch to plan type when clicking plan button', () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      fireEvent.click(screen.getByText('📁 Plano Completo'))

      expect(screen.getByLabelText(/Plano de Tratamento/i)).toBeInTheDocument()
      expect(screen.queryByLabelText(/Protocolo/i)).not.toBeInTheDocument()
    })

    it('should switch back to protocol type when clicking protocol button', () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Switch to plan first
      fireEvent.click(screen.getByText('📁 Plano Completo'))
      expect(screen.getByLabelText(/Plano de Tratamento/i)).toBeInTheDocument()

      // Switch back to protocol
      fireEvent.click(screen.getByText('💊 Único Remédio'))
      expect(screen.getByLabelText(/Protocolo/i)).toBeInTheDocument()
    })

    it('should disable plan type toggle when editing existing log', () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          initialValues={{ id: 'log-1', protocol_id: 'proto-1' }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('📁 Plano Completo')).toBeDisabled()
    })
  })

  describe('protocol selection', () => {
    it('should show protocol info when protocol selected', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      const select = screen.getByLabelText(/Protocolo/i)
      fireEvent.change(select, { target: { value: 'proto-1' } })

      expect(screen.getByText(/Medicamento:/i)).toBeInTheDocument()
      expect(screen.getByText('Dipirona')).toBeInTheDocument()
    })

    it('should show quantity input with default dosage when protocol selected', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      const select = screen.getByLabelText(/Protocolo/i)
      fireEvent.change(select, { target: { value: 'proto-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade Tomada/i)
      expect(quantityInput).toHaveValue(1)
    })
  })

  describe('plan selection', () => {
    it('should auto-select all active protocols when plan selected', () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Switch to plan type
      fireEvent.click(screen.getByText('📁 Plano Completo'))

      const planSelect = screen.getByLabelText(/Plano de Tratamento/i)
      fireEvent.change(planSelect, { target: { value: 'plan-1' } })

      // Check that protocol items are rendered
      expect(screen.getByTestId('protocol-item-proto-1')).toHaveClass('selected')
      expect(screen.getByTestId('protocol-item-proto-2')).toHaveClass('selected')
    })

    it('should allow toggling individual protocols in plan', () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Switch to plan type and select plan
      fireEvent.click(screen.getByText('📁 Plano Completo'))
      const planSelect = screen.getByLabelText(/Plano de Tratamento/i)
      fireEvent.change(planSelect, { target: { value: 'plan-1' } })

      // Toggle off one protocol
      fireEvent.click(screen.getByTestId('protocol-item-proto-1'))

      expect(screen.getByTestId('protocol-item-proto-1')).not.toHaveClass('selected')
      expect(screen.getByTestId('protocol-item-proto-2')).toHaveClass('selected')
    })

    it('should show count of selected protocols', () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Switch to plan type and select plan
      fireEvent.click(screen.getByText('📁 Plano Completo'))
      const planSelect = screen.getByLabelText(/Plano de Tratamento/i)
      fireEvent.change(planSelect, { target: { value: 'plan-1' } })

      expect(screen.getByText('2 selecionados')).toBeInTheDocument()
    })
  })

  describe('validation', () => {
    it('should show error when protocol not selected', async () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      fireEvent.click(screen.getByText('✅ Registrar Dose'))

      await waitFor(() => {
        expect(screen.getByText('Selecione um protocolo')).toBeInTheDocument()
      })
    })

    it('should show error when plan not selected', async () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Switch to plan type
      fireEvent.click(screen.getByText('📁 Plano Completo'))
      fireEvent.click(screen.getByText(/Registrar/))

      await waitFor(() => {
        expect(screen.getByText('Selecione um plano')).toBeInTheDocument()
      })
    })

    it('should show error when no protocols selected in plan', async () => {
      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Switch to plan type
      fireEvent.click(screen.getByText('📁 Plano Completo'))

      // Select plan
      const planSelect = screen.getByLabelText(/Plano de Tratamento/i)
      fireEvent.change(planSelect, { target: { value: 'plan-1' } })

      // Deselect all protocols
      fireEvent.click(screen.getByTestId('protocol-item-proto-1'))
      fireEvent.click(screen.getByTestId('protocol-item-proto-2'))

      fireEvent.click(screen.getByText(/Registrar/))

      await waitFor(() => {
        expect(
          screen.getByText('Selecione pelo menos um medicamento para registrar')
        ).toBeInTheDocument()
      })
    })

    it('should clear error when field is corrected', async () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      // Trigger error
      fireEvent.click(screen.getByText('✅ Registrar Dose'))

      await waitFor(() => {
        expect(screen.getByText('Selecione um protocolo')).toBeInTheDocument()
      })

      // Fix error
      const select = screen.getByLabelText(/Protocolo/i)
      fireEvent.change(select, { target: { value: 'proto-1' } })

      expect(screen.queryByText('Selecione um protocolo')).not.toBeInTheDocument()
    })
  })

  describe('form submission - protocol mode', () => {
    it('should call onSave with correct data for new protocol log', async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      // Select protocol
      const select = screen.getByLabelText(/Protocolo/i)
      fireEvent.change(select, { target: { value: 'proto-1' } })

      // Set quantity
      const quantityInput = screen.getByLabelText(/Quantidade Tomada/i)
      fireEvent.change(quantityInput, { target: { value: '2' } })

      // Add notes
      const notesInput = screen.getByLabelText(/Observações/i)
      fireEvent.change(notesInput, { target: { value: 'Test note' } })

      // Submit
      fireEvent.click(screen.getByText('✅ Registrar Dose'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            protocol_id: 'proto-1',
            medicine_id: 'med-1',
            quantity_taken: 2,
            notes: 'Test note',
          })
        )
      })
    })

    it('should call onSave with id when editing existing log', async () => {
      mockOnSave.mockResolvedValue(undefined)

      const initialValues = {
        id: 'log-1',
        protocol_id: 'proto-1',
        quantity_taken: 1,
        taken_at: '2024-01-15T10:00:00Z',
        notes: 'Existing note',
      }

      render(
        <LogForm
          protocols={mockProtocols}
          initialValues={initialValues}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Update quantity
      const quantityInput = screen.getByLabelText(/Quantidade Tomada/i)
      fireEvent.change(quantityInput, { target: { value: '3' } })

      // Submit
      fireEvent.click(screen.getByText('💾 Atualizar Registro'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'log-1',
            protocol_id: 'proto-1',
            quantity_taken: 3,
          })
        )
      })
    })

    it('should use protocol default dosage when quantity not specified', async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      // Select protocol
      const select = screen.getByLabelText(/Protocolo/i)
      fireEvent.change(select, { target: { value: 'proto-1' } })

      // Submit without changing quantity
      fireEvent.click(screen.getByText('✅ Registrar Dose'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            quantity_taken: 1, // Default from protocol
          })
        )
      })
    })
  })

  describe('form submission - plan mode', () => {
    it('should call onSave with array of logs for plan', async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Switch to plan type
      fireEvent.click(screen.getByText('📁 Plano Completo'))

      // Select plan
      const planSelect = screen.getByLabelText(/Plano de Tratamento/i)
      fireEvent.change(planSelect, { target: { value: 'plan-1' } })

      // Add notes
      const notesInput = screen.getByLabelText(/Observações/i)
      fireEvent.change(notesInput, { target: { value: 'Plan note' } })

      // Submit - look for button with count
      fireEvent.click(screen.getByText(/Registrar \(2\)/))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              protocol_id: 'proto-1',
              medicine_id: 'med-1',
              quantity_taken: 1,
            }),
            expect.objectContaining({
              protocol_id: 'proto-2',
              medicine_id: 'med-2',
              quantity_taken: 2,
            }),
          ])
        )
      })
    })

    it('should include plan name in notes for bulk logs', async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(
        <LogForm
          protocols={mockProtocols}
          treatmentPlans={mockTreatmentPlans}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Switch to plan type
      fireEvent.click(screen.getByText('📁 Plano Completo'))

      // Select plan
      const planSelect = screen.getByLabelText(/Plano de Tratamento/i)
      fireEvent.change(planSelect, { target: { value: 'plan-1' } })

      // Submit
      fireEvent.click(screen.getByText(/Registrar/))

      await waitFor(() => {
        const calls = mockOnSave.mock.calls[0][0]
        expect(calls[0].notes).toContain('[Plan: Tratamento Completo]')
      })
    })
  })

  describe('error handling', () => {
    it('should display error when onSave throws', async () => {
      mockOnSave.mockRejectedValue(new Error('Stock insufficient'))

      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      // Select protocol and submit
      const select = screen.getByLabelText(/Protocolo/i)
      fireEvent.change(select, { target: { value: 'proto-1' } })
      fireEvent.click(screen.getByText('✅ Registrar Dose'))

      await waitFor(() => {
        expect(screen.getByText('Stock insufficient')).toBeInTheDocument()
      })
    })

    it('should disable buttons while submitting', async () => {
      let resolveSave
      mockOnSave.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve
          })
      )

      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      // Select protocol and submit
      const select = screen.getByLabelText(/Protocolo/i)
      fireEvent.change(select, { target: { value: 'proto-1' } })
      fireEvent.click(screen.getByText('✅ Registrar Dose'))

      await waitFor(() => {
        expect(screen.getByText('Cancelar')).toBeDisabled()
        expect(screen.getByText('Salvando...')).toBeInTheDocument()
      })

      // Resolve the promise
      resolveSave()
    })
  })

  describe('cancel action', () => {
    it('should call onCancel when cancel button clicked', () => {
      render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)

      fireEvent.click(screen.getByText('Cancelar'))

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('editing mode', () => {
    it('should populate form with initial values', () => {
      const initialValues = {
        id: 'log-1',
        protocol_id: 'proto-1',
        quantity_taken: 3,
        taken_at: '2024-01-15T10:00:00Z',
        notes: 'Existing note',
      }

      render(
        <LogForm
          protocols={mockProtocols}
          initialValues={initialValues}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('💾 Atualizar Registro')).toBeInTheDocument()

      const quantityInput = screen.getByLabelText(/Quantidade Tomada/i)
      expect(quantityInput).toHaveValue(3)

      const notesInput = screen.getByLabelText(/Observações/i)
      expect(notesInput).toHaveValue('Existing note')
    })
  })
})
