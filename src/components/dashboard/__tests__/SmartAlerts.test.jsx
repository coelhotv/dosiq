import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SmartAlerts } from '../SmartAlerts'
import '@testing-library/jest-dom'

// Mock do useDashboardContext
vi.mock('../../../hooks/useDashboardContext', () => ({
  useDashboardContext: vi.fn()
}))

describe('SmartAlerts', () => {
  const mockAlerts = [
    {
      id: 'alert-1',
      type: 'medication_due',
      title: 'Hora do medicamento',
      message: 'Dipirona 500mg está programada para agora',
      medicine_id: 'med-1',
      medicine_name: 'Dipirona',
      dosage: '500mg',
      scheduled_time: '08:00',
      taken_at: null,
      protocol_id: 'proto-1'
    },
    {
      id: 'alert-2',
      type: 'low_stock',
      title: 'Estoque baixo',
      message: 'Paracetamol está com apenas 5 unidades',
      medicine_id: 'med-2',
      medicine_name: 'Paracetamol',
      current_stock: 5,
      threshold: 10
    }
  ]

  const mockOnRegister = vi.fn()
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render alerts list when there are alerts', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      smartAlerts: mockAlerts,
      loading: false,
      onRegister: mockOnRegister,
      onDismiss: mockOnDismiss
    })

    render(<SmartAlerts />)

    expect(screen.getByText('Hora do medicamento')).toBeInTheDocument()
    expect(screen.getByText('Estoque baixo')).toBeInTheDocument()
  })

  it('should render empty state when no alerts', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      smartAlerts: [],
      loading: false,
      onRegister: mockOnRegister,
      onDismiss: mockOnDismiss
    })

    render(<SmartAlerts />)

    expect(screen.getByText('Nenhum alerta no momento')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      smartAlerts: [],
      loading: true,
      onRegister: mockOnRegister,
      onDismiss: mockOnDismiss
    })

    render(<SmartAlerts />)

    expect(screen.getByText('Carregando alertas...')).toBeInTheDocument()
  })

  it('should call onRegister when medication alert is clicked', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      smartAlerts: [mockAlerts[0]],
      loading: false,
      onRegister: mockOnRegister,
      onDismiss: mockOnDismiss
    })

    render(<SmartAlerts />)

    const registerButton = screen.getByText('Registrar')
    fireEvent.click(registerButton)

    expect(mockOnRegister).toHaveBeenCalledWith(mockAlerts[0])
  })

  it('should call onDismiss when dismiss button is clicked', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      smartAlerts: [mockAlerts[1]],
      loading: false,
      onRegister: mockOnRegister,
      onDismiss: mockOnDismiss
    })

    render(<SmartAlerts />)

    const dismissButton = screen.getByLabelText('Fechar')
    fireEvent.click(dismissButton)

    expect(mockOnDismiss).toHaveBeenCalledWith('alert-2')
  })

  it('should display correct icon based on alert type', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      smartAlerts: mockAlerts,
      loading: false,
      onRegister: mockOnRegister,
      onDismiss: mockOnDismiss
    })

    render(<SmartAlerts />)

    // Check for medication icon (pill/medicine)
    expect(screen.getByTestId('medication-icon')).toBeInTheDocument()
  })
})

describe('SmartAlerts - Alert Types', () => {
  it('should format medication due alert correctly', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    const alert = {
      id: 'alert-1',
      type: 'medication_due',
      title: 'Hora do medicamento',
      message: 'Dipirona 500mg está programada para agora',
      medicine_name: 'Dipirona',
      dosage: '500mg',
      scheduled_time: '08:00'
    }

    useDashboardContext.mockReturnValue({
      smartAlerts: [alert],
      loading: false,
      onRegister: vi.fn(),
      onDismiss: vi.fn()
    })

    render(<SmartAlerts />)

    expect(screen.getByText('Dipirona 500mg')).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
  })

  it('should format low stock alert correctly', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    const alert = {
      id: 'alert-2',
      type: 'low_stock',
      title: 'Estoque baixo',
      message: 'Paracetamol está com apenas 5 unidades',
      medicine_name: 'Paracetamol',
      current_stock: 5,
      threshold: 10
    }

    useDashboardContext.mockReturnValue({
      smartAlerts: [alert],
      loading: false,
      onRegister: vi.fn(),
      onDismiss: vi.fn()
    })

    render(<SmartAlerts />)

    expect(screen.getByText('Paracetamol')).toBeInTheDocument()
    expect(screen.getByText('5 un.')).toBeInTheDocument()
  })

  it('should format missed medication alert correctly', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    const alert = {
      id: 'alert-3',
      type: 'missed_medication',
      title: 'Dose esquecida',
      message: 'Você esqueceu de tomar Omeprazol às 08:00',
      medicine_name: 'Omeprazol',
      dosage: '20mg',
      scheduled_time: '08:00',
      minutes_late: 45
    }

    useDashboardContext.mockReturnValue({
      smartAlerts: [alert],
      loading: false,
      onRegister: vi.fn(),
      onDismiss: vi.fn()
    })

    render(<SmartAlerts />)

    expect(screen.getByText('Omeprazol 20mg')).toBeInTheDocument()
    expect(screen.getByText('45min atrasado')).toBeInTheDocument()
  })
})
