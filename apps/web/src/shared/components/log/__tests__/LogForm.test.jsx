import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import LogForm from '@/shared/components/log/LogForm'

// Mock dependencies
vi.mock('lucide-react', () => ({
  Pill: () => <div data-testid="icon-pill" />,
  Folders: () => <div data-testid="icon-folders" />,
  Clock: () => <div data-testid="icon-clock" />,
  Calendar: () => <div data-testid="icon-calendar" />,
  Hash: () => <div data-testid="icon-hash" />,
  Save: () => <div data-testid="icon-save" />,
  X: () => <div data-testid="icon-x" />,
  Info: () => <div data-testid="icon-info" />,
  Plus: () => <div data-testid="icon-plus" />
}))

vi.mock('@shared/components/ui/Button', () => ({
  default: ({ children, onClick, disabled, variant }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  )
}))

vi.mock('@protocols/components/ProtocolChecklistItem', () => ({
  default: ({ protocol, isSelected, onToggle }) => (
    <div data-testid={`checklist-item-${protocol.id}`} onClick={onToggle}>
      {protocol.medicine_name} {isSelected ? '(Selected)' : ''}
    </div>
  )
}))

// Mock dateUtils to have stable values
vi.mock('@utils/dateUtils', () => ({
  getNow: () => new Date('2026-05-02T12:00:00'),
  parseISO: (s) => new Date(s),
  parseLocalDatetime: (s) => new Date(s)
}))

describe('LogForm', () => {
  const mockProtocols = [
    { 
      id: '1', 
      name: 'Tratamento 1', 
      medicine: { name: 'Dipirona' },
      dosage_per_intake: '1 pill', 
      active: true 
    },
    { 
      id: '2', 
      name: 'Tratamento 2', 
      medicine: { name: 'Losartana' },
      dosage_per_intake: '2 pills', 
      active: true 
    }
  ]
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render form with title', () => {
    render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)
    expect(screen.getByText(/Registrar Medicamento/i)).toBeInTheDocument()
  })

  it('should toggle between single and plan modes', () => {
    const mockPlans = [{ id: 'p1', name: 'Plano', protocols: mockProtocols }]
    render(<LogForm protocols={mockProtocols} treatmentPlans={mockPlans} onSave={mockOnSave} onCancel={mockOnCancel} />)
    
    // Default is single
    expect(screen.getByText(/Único Remédio/i)).toBeInTheDocument()
    
    // Toggle to plan
    const planBtn = screen.getByText(/Plano Completo/i)
    fireEvent.click(planBtn)
    
    expect(screen.getByText(/Selecione um plano/i)).toBeInTheDocument()
  })

  it('should call onCancel when cancel button clicked', () => {
    render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)
    const cancelBtn = screen.getByText(/Cancelar/i)
    fireEvent.click(cancelBtn)
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should call onSave with form data when submitted', () => {
    render(<LogForm protocols={mockProtocols} onSave={mockOnSave} onCancel={mockOnCancel} />)
    
    // Fill quantity
    const quantityInput = screen.getByLabelText(/Quantidade Tomada/i)
    fireEvent.change(quantityInput, { target: { value: '2' } })
    
    // Submit
    const saveBtn = screen.getByText(/Registrar Dose/i)
    fireEvent.click(saveBtn)
    
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
      quantity_taken: 2,
      protocol_id: '1'
    }))
  })
})
