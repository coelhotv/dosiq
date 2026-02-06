import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StockAlertsWidget } from '../StockAlertsWidget'
import '@testing-library/jest-dom'

// Mock do useDashboardContext
vi.mock('../../../hooks/useDashboardContext', () => ({
  useDashboardContext: vi.fn()
}))

describe('StockAlertsWidget', () => {
  const mockOnAddStock = vi.fn()
  const mockOnViewDetails = vi.fn()

  const mockLowStockItems = [
    {
      id: 'stock-1',
      medicine_id: 'med-1',
      medicine_name: 'Dipirona',
      current_quantity: 5,
      threshold: 10,
      unit: 'un',
      days_until_empty: 5,
      priority: 'high'
    },
    {
      id: 'stock-2',
      medicine_id: 'med-2',
      medicine_name: 'Paracetamol',
      current_quantity: 8,
      threshold: 10,
      unit: 'un',
      days_until_empty: 10,
      priority: 'medium'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render low stock items list', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: mockLowStockItems,
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    expect(screen.getByText('Dipirona')).toBeInTheDocument()
    expect(screen.getByText('Paracetamol')).toBeInTheDocument()
  })

  it('should show empty state when no low stock items', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    expect(screen.getByText('Todos os medicamentos com estoque adequado')).toBeInTheDocument()
    expect(screen.getByText('✅')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [],
      loading: true
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    expect(screen.getByText('Verificando estoque...')).toBeInTheDocument()
  })

  it('should display correct quantity and threshold', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [mockLowStockItems[0]],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    expect(screen.getByText('5/10 un')).toBeInTheDocument()
  })

  it('should display days until empty', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [mockLowStockItems[0]],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    expect(screen.getByText('5 dias')).toBeInTheDocument()
  })

  it('should call onAddStock when add button is clicked', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [mockLowStockItems[0]],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    const addButton = screen.getByLabelText('Adicionar Dipirona')
    fireEvent.click(addButton)

    expect(mockOnAddStock).toHaveBeenCalledWith('med-1')
  })

  it('should highlight high priority items', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: mockLowStockItems,
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    const highPriorityItem = screen.getByText('Dipirona').closest('.stock-item')
    expect(highPriorityItem).toHaveClass('priority-high')
  })

  it('should show critical warning for very low stock', () => {
    const criticalItem = {
      ...mockLowStockItems[0],
      current_quantity: 1,
      days_until_empty: 1,
      priority: 'critical'
    }

    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [criticalItem],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    expect(screen.getByText('🚨 Crítico')).toBeInTheDocument()
  })

  it('should call onViewDetails when item is clicked', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [mockLowStockItems[0]],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    const item = screen.getByText('Dipirona')
    fireEvent.click(item)

    expect(mockOnViewDetails).toHaveBeenCalledWith('med-1')
  })

  it('should display progress bar correctly', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [mockLowStockItems[0]],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={mockOnAddStock} onViewDetails={mockOnViewDetails} />)

    const progressBar = screen.getByTestId('stock-progress')
    expect(progressBar).toHaveStyle({ width: '50%' })
  })
})

describe('StockAlertsWidget - Widget Header', () => {
  it('should display correct header title', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={() => {}} onViewDetails={() => {}} />)

    expect(screen.getByText('📦 Estoque')).toBeInTheDocument()
  })

  it('should show count badge with number of low stock items', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      lowStockItems: [
        { id: '1', medicine_name: 'Med 1' },
        { id: '2', medicine_name: 'Med 2' },
        { id: '3', medicine_name: 'Med 3' }
      ],
      loading: false
    })

    render(<StockAlertsWidget onAddStock={() => {}} onViewDetails={() => {}} />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
