import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CostChart from '@/features/stock/components/CostChart'

afterEach(() => {
  vi.clearAllMocks()
})

const mockItems = [
  { name: 'Losartana', monthlyCost: 45 },
  { name: 'Metformina', monthlyCost: 32 },
  { name: 'Omeprazol', monthlyCost: 48 },
  { name: 'Vitamina D', monthlyCost: 22 },
]

describe('CostChart', () => {
  it('renderiza barras para todos os items', () => {
    render(<CostChart items={mockItems} totalMonthly={147} />)
    expect(screen.getByText('Losartana')).toBeInTheDocument()
    expect(screen.getByText('Metformina')).toBeInTheDocument()
    expect(screen.getByText('Omeprazol')).toBeInTheDocument()
    expect(screen.getByText('Vitamina D')).toBeInTheDocument()
  })

  it('exibe total formatado em BRL', () => {
    render(<CostChart items={mockItems} totalMonthly={187} />)
    expect(screen.getByText(/R\$\s?187/)).toBeInTheDocument()
  })

  it('exibe valores individuais formatados em BRL', () => {
    render(<CostChart items={[{ name: 'Losartana', monthlyCost: 45 }]} totalMonthly={45} />)
    // Deve aparecer R$45,00 (ou similar)
    const values = screen.getAllByText(/R\$\s?45/)
    expect(values.length).toBeGreaterThan(0)
  })

  it('exibe projeção de 3 meses quando fornecida', () => {
    render(<CostChart items={mockItems} totalMonthly={147} projection3m={441} />)
    expect(screen.getByText(/R\$\s?441/)).toBeInTheDocument()
    expect(screen.getByText('Projeção 3m:')).toBeInTheDocument()
  })

  it('não exibe projeção quando não fornecida', () => {
    render(<CostChart items={mockItems} totalMonthly={147} />)
    expect(screen.queryByText('Projeção 3m:')).not.toBeInTheDocument()
  })

  it('mostra empty state quando items=[]', () => {
    render(<CostChart items={[]} totalMonthly={0} />)
    expect(screen.getByText('Adicione preços no estoque para ver custos')).toBeInTheDocument()
  })

  it('mostra empty state quando totalMonthly=0', () => {
    render(<CostChart items={mockItems} totalMonthly={0} />)
    expect(screen.getByText('Adicione preços no estoque para ver custos')).toBeInTheDocument()
  })

  it('chama onExpand ao clicar em "Ver análise completa"', () => {
    const onExpand = vi.fn()
    render(<CostChart items={mockItems} totalMonthly={147} onExpand={onExpand} />)
    fireEvent.click(screen.getByText('Ver análise completa →'))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('mostra link "Ir para Estoque" no empty state com onExpand', () => {
    const onExpand = vi.fn()
    render(<CostChart items={[]} totalMonthly={0} onExpand={onExpand} />)
    fireEvent.click(screen.getByText('Ir para Estoque →'))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('não mostra "Ver análise completa" sem onExpand', () => {
    render(<CostChart items={mockItems} totalMonthly={147} />)
    expect(screen.queryByText('Ver análise completa →')).not.toBeInTheDocument()
  })
})
