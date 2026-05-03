import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StockBars from '@/features/dashboard/components/StockBars'

afterEach(() => {
  vi.clearAllMocks()
})

const mockItems = [
  {
    medicineId: '1',
    name: 'Losartana',
    currentStock: 8,
    dailyConsumption: 2,
    daysRemaining: 4,
    level: 'critical',
  },
  {
    medicineId: '2',
    name: 'Metformina',
    currentStock: 60,
    dailyConsumption: 2,
    daysRemaining: 30,
    level: 'normal',
  },
  {
    medicineId: '3',
    name: 'Omeprazol',
    currentStock: 0,
    dailyConsumption: 1,
    daysRemaining: 0,
    level: 'critical',
  },
  {
    medicineId: '4',
    name: 'Vitamina D com nome longo',
    currentStock: 180,
    dailyConsumption: 2,
    daysRemaining: 90,
    level: 'high',
  },
  {
    medicineId: '5',
    name: 'Atorvastatina',
    currentStock: 20,
    dailyConsumption: 2,
    daysRemaining: 10,
    level: 'low',
  },
]

describe('StockBars', () => {
  it('renderiza barras para todos os items', () => {
    render(<StockBars items={mockItems} />)
    expect(screen.getByText('Losartana')).toBeInTheDocument()
    expect(screen.getByText('Metformina')).toBeInTheDocument()
    expect(screen.getByText('Omeprazol')).toBeInTheDocument()
  })

  it('mostra estado vazio quando items=[]', () => {
    render(<StockBars items={[]} />)
    expect(screen.getByText('Nenhum item de estoque para exibir')).toBeInTheDocument()
  })

  it('filtra só críticos quando showOnlyCritical=true', () => {
    render(<StockBars items={mockItems} showOnlyCritical />)
    expect(screen.getByText('Losartana')).toBeInTheDocument()
    expect(screen.getByText('Omeprazol')).toBeInTheDocument()
    expect(screen.getByText('Atorvastatina')).toBeInTheDocument()
    expect(screen.queryByText('Metformina')).not.toBeInTheDocument()
    expect(screen.queryByText('Vitamina D com nome longo')).not.toBeInTheDocument()
  })

  it('limita quantidade com maxItems', () => {
    render(<StockBars items={mockItems} maxItems={2} />)
    expect(screen.getByText('Losartana')).toBeInTheDocument()
    expect(screen.getByText('Metformina')).toBeInTheDocument()
    expect(screen.queryByText('Omeprazol')).not.toBeInTheDocument()
  })

  it('chama onItemClick com medicineId ao clicar', () => {
    const onItemClick = vi.fn()
    render(<StockBars items={mockItems} onItemClick={onItemClick} />)
    fireEvent.click(screen.getByText('Losartana').closest('.stock-bars__item'))
    expect(onItemClick).toHaveBeenCalledWith('1')
  })

  it('mostra class pulse-critical em barras critical', () => {
    const { container } = render(<StockBars items={mockItems} />)
    const criticalFills = container.querySelectorAll('.stock-bars__fill.pulse-critical')
    // 2 itens críticos: Losartana + Omeprazol
    expect(criticalFills.length).toBe(2)
  })

  it('não mostra pulse em barras não-críticas', () => {
    const normalItem = [
      {
        medicineId: '2',
        name: 'Metformina',
        currentStock: 60,
        dailyConsumption: 2,
        daysRemaining: 30,
        level: 'normal',
      },
    ]
    const { container } = render(<StockBars items={normalItem} />)
    expect(container.querySelector('.pulse-critical')).toBeNull()
  })

  it('mostra "90d+" para estoque muito alto', () => {
    render(<StockBars items={[mockItems[3]]} />)
    expect(screen.getByText('90d+')).toBeInTheDocument()
  })

  it('mostra "0d" para estoque zerado', () => {
    render(<StockBars items={[mockItems[2]]} />)
    expect(screen.getByText('0d')).toBeInTheDocument()
  })

  it('aceita className customizado', () => {
    const { container } = render(<StockBars items={mockItems} className="meu-stock" />)
    expect(container.firstChild).toHaveClass('meu-stock')
  })
})
