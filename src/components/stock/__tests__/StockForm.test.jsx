import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StockForm from '../StockForm'

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
  )
}))

describe('StockForm', () => {
  const mockMedicines = [
    {
      id: 'med-1',
      name: 'Dipirona',
      dosage_per_pill: 500,
      dosage_unit: 'mg'
    },
    {
      id: 'med-2',
      name: 'Paracetamol',
      dosage_per_pill: 750,
      dosage_unit: 'mg'
    },
    {
      id: 'med-3',
      name: 'Vitamina C',
      dosage_per_pill: 1000,
      dosage_unit: 'mg'
    }
  ]

  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render form with title', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Adicionar Estoque')).toBeInTheDocument()
    })

    it('should render medicine select with options', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/Medicamento/i)).toBeInTheDocument()
      
      // Check that medicines are listed with dosage info
      expect(screen.getByText('Dipirona (500mg)')).toBeInTheDocument()
      expect(screen.getByText('Paracetamol (750mg)')).toBeInTheDocument()
    })

    it('should render quantity input', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      expect(quantityInput).toBeInTheDocument()
      expect(quantityInput).toHaveAttribute('type', 'number')
      expect(quantityInput).toHaveAttribute('min', '0.1')
      expect(quantityInput).toHaveAttribute('step', '0.1')
    })

    it('should render unit price input', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const priceInput = screen.getByLabelText(/Preço Unitário/i)
      expect(priceInput).toBeInTheDocument()
      expect(priceInput).toHaveAttribute('type', 'number')
      expect(priceInput).toHaveAttribute('step', '0.001')
      expect(priceInput).toHaveAttribute('min', '0')
    })

    it('should render purchase date input with default to today', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const dateInput = screen.getByLabelText(/Data da Compra/i)
      expect(dateInput).toBeInTheDocument()
      expect(dateInput).toHaveAttribute('type', 'date')
      
      // Should have today's date as default
      const today = new Date().toISOString().split('T')[0]
      expect(dateInput).toHaveValue(today)
    })

    it('should render expiration date input', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const dateInput = screen.getByLabelText(/Data de Validade/i)
      expect(dateInput).toBeInTheDocument()
      expect(dateInput).toHaveAttribute('type', 'date')
    })

    it('should render cancel and submit buttons', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Adicionar Estoque/i })).toBeInTheDocument()
    })
  })

  describe('initial values', () => {
    it('should populate form with initial values when provided', () => {
      const initialValues = {
        medicine_id: 'med-2',
        quantity: 30,
        unit_price: 0.5,
        purchase_date: '2024-01-15',
        expiration_date: '2025-01-15'
      }

      render(
        <StockForm 
          medicines={mockMedicines}
          initialValues={initialValues}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/Medicamento/i)).toHaveValue('med-2')
      expect(screen.getByLabelText(/Quantidade/i)).toHaveValue(30)
      expect(screen.getByLabelText(/Preço Unitário/i)).toHaveValue(0.5)
      expect(screen.getByLabelText(/Data da Compra/i)).toHaveValue('2024-01-15')
      expect(screen.getByLabelText(/Data de Validade/i)).toHaveValue('2025-01-15')
    })

    it('should handle partial initial values', () => {
      const initialValues = {
        medicine_id: 'med-1'
      }

      render(
        <StockForm 
          medicines={mockMedicines}
          initialValues={initialValues}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/Medicamento/i)).toHaveValue('med-1')
      expect(screen.getByLabelText(/Quantidade/i)).toHaveValue('')
    })
  })

  describe('validation', () => {
    it('should show error when medicine not selected', async () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Set quantity but not medicine
      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByText('Selecione um medicamento')).toBeInTheDocument()
      })
    })

    it('should show error when quantity is zero', async () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Select medicine and set quantity to 0
      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '0' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByText('Quantidade deve ser maior que zero')).toBeInTheDocument()
      })
    })

    it('should show error when quantity is negative', async () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '-5' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByText('Quantidade deve ser maior que zero')).toBeInTheDocument()
      })
    })

    it('should show error when quantity is empty', async () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByText('Quantidade deve ser maior que zero')).toBeInTheDocument()
      })
    })

    it('should show error when unit price is not a number', async () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10' } })

      const priceInput = screen.getByLabelText(/Preço Unitário/i)
      fireEvent.change(priceInput, { target: { value: 'invalid' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByText('Deve ser um número')).toBeInTheDocument()
      })
    })

    it('should show error when expiration date is before purchase date', async () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10' } })

      const purchaseDateInput = screen.getByLabelText(/Data da Compra/i)
      fireEvent.change(purchaseDateInput, { target: { value: '2024-06-01' } })

      const expirationDateInput = screen.getByLabelText(/Data de Validade/i)
      fireEvent.change(expirationDateInput, { target: { value: '2024-01-01' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByText('Data de validade não pode ser anterior à compra')).toBeInTheDocument()
      })
    })

    it('should clear error when field is corrected', async () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Trigger error
      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByText('Selecione um medicamento')).toBeInTheDocument()
      })

      // Fix error
      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      await waitFor(() => {
        expect(screen.queryByText('Selecione um medicamento')).not.toBeInTheDocument()
      })
    })
  })

  describe('form submission', () => {
    it('should call onSave with correct data when form is valid', async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Fill in the form
      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '30' } })

      const priceInput = screen.getByLabelText(/Preço Unitário/i)
      fireEvent.change(priceInput, { target: { value: '0.5' } })

      const purchaseDateInput = screen.getByLabelText(/Data da Compra/i)
      fireEvent.change(purchaseDateInput, { target: { value: '2024-01-15' } })

      const expirationDateInput = screen.getByLabelText(/Data de Validade/i)
      fireEvent.change(expirationDateInput, { target: { value: '2025-01-15' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          medicine_id: 'med-1',
          quantity: 30,
          unit_price: 0.5,
          purchase_date: '2024-01-15',
          expiration_date: '2025-01-15'
        })
      })
    })

    it('should parse float values correctly', async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10.5' } })

      const priceInput = screen.getByLabelText(/Preço Unitário/i)
      fireEvent.change(priceInput, { target: { value: '1.234' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
          quantity: 10.5,
          unit_price: 1.234
        }))
      })
    })

    it('should use 0 as default unit price when not provided', async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
          unit_price: 0
        }))
      })
    })

    it('should use null for dates when not provided', async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10' } })

      // Clear dates
      const purchaseDateInput = screen.getByLabelText(/Data da Compra/i)
      fireEvent.change(purchaseDateInput, { target: { value: '' } })

      const expirationDateInput = screen.getByLabelText(/Data de Validade/i)
      fireEvent.change(expirationDateInput, { target: { value: '' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
          purchase_date: null,
          expiration_date: null
        }))
      })
    })

    it('should disable buttons while submitting', async () => {
      let resolveSave
      mockOnSave.mockImplementation(() => new Promise(resolve => {
        resolveSave = resolve
      }))

      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      // Fill in required fields
      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancelar/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /Salvando/i })).toBeInTheDocument()
      })

      // Resolve the promise
      resolveSave()
    })

    it('should display error when onSave throws', async () => {
      mockOnSave.mockRejectedValue(new Error('Database error'))

      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-1' } })

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10' } })

      fireEvent.click(screen.getByRole('button', { name: /Adicionar Estoque/i }))

      await waitFor(() => {
        expect(screen.getByText('Database error')).toBeInTheDocument()
      })
    })
  })

  describe('cancel action', () => {
    it('should call onCancel when cancel button clicked', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }))

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('input changes', () => {
    it('should update form data when inputs change', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const medicineSelect = screen.getByLabelText(/Medicamento/i)
      fireEvent.change(medicineSelect, { target: { value: 'med-2' } })
      expect(medicineSelect).toHaveValue('med-2')

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '50' } })
      expect(quantityInput).toHaveValue(50)
    })

    it('should handle decimal values correctly', () => {
      render(
        <StockForm 
          medicines={mockMedicines}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const quantityInput = screen.getByLabelText(/Quantidade/i)
      fireEvent.change(quantityInput, { target: { value: '10.5' } })
      expect(quantityInput).toHaveValue(10.5)

      const priceInput = screen.getByLabelText(/Preço Unitário/i)
      fireEvent.change(priceInput, { target: { value: '0.123' } })
      expect(priceInput).toHaveValue(0.123)
    })
  })
})
