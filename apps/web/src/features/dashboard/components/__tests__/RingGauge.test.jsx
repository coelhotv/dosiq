import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RingGauge from '@/features/dashboard/components/RingGauge'

vi.mock('../SparklineAdesao', () => ({
  default: ({ data, size }) => (
    <div data-testid="sparkline" data-size={size} data-points={data?.length} />
  ),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('RingGauge', () => {
  it('renderiza score e streak corretamente', () => {
    render(<RingGauge score={85} streak={12} />)
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('12d')).toBeInTheDocument()
  })

  it('tem aria-label descritivo', () => {
    render(<RingGauge score={72} streak={5} />)
    const svg = screen.getByRole('img')
    expect(svg).toHaveAttribute('aria-label', 'Adesão: 72%. Streak: 5 dias')
  })

  it('aplica classe de size correta — large', () => {
    const { container } = render(<RingGauge score={90} streak={7} size="large" />)
    expect(container.firstChild).toHaveClass('ring-gauge--large')
  })

  it('aplica classe de size correta — medium', () => {
    const { container } = render(<RingGauge score={90} streak={7} size="medium" />)
    expect(container.firstChild).toHaveClass('ring-gauge--medium')
  })

  it('aplica classe de size correta — compact', () => {
    const { container } = render(<RingGauge score={90} streak={7} size="compact" />)
    expect(container.firstChild).toHaveClass('ring-gauge--compact')
  })

  it('mostra mensagem de incentivo no size large — score 100', () => {
    render(<RingGauge score={100} streak={30} size="large" />)
    expect(screen.getByText('Perfeito!')).toBeInTheDocument()
  })

  it('mostra mensagem de incentivo no size large — score 85', () => {
    render(<RingGauge score={85} streak={7} size="large" />)
    expect(screen.getByText('Muito Bom!')).toBeInTheDocument()
  })

  it('mostra mensagem de incentivo no size large — score 70', () => {
    render(<RingGauge score={70} streak={2} size="large" />)
    expect(screen.getByText('Bom trabalho!')).toBeInTheDocument()
  })

  it('mostra mensagem de incentivo no size large — score 50', () => {
    render(<RingGauge score={50} streak={1} size="large" />)
    expect(screen.getByText('Continue assim!')).toBeInTheDocument()
  })

  it('mostra mensagem de incentivo no size large — score baixo', () => {
    render(<RingGauge score={30} streak={0} size="large" />)
    expect(screen.getByText('Vamos melhorar!')).toBeInTheDocument()
  })

  it('não mostra mensagem de incentivo no size medium', () => {
    render(<RingGauge score={85} streak={7} size="medium" />)
    expect(screen.queryByText('Muito Bom!')).not.toBeInTheDocument()
  })

  it('renderiza sparkline inline no size medium quando há dados', () => {
    const sparklineData = [
      { date: '2026-02-27', adherence: 80 },
      { date: '2026-02-28', adherence: 90 },
      { date: '2026-03-01', adherence: 100 },
    ]
    render(<RingGauge score={85} streak={7} size="medium" sparklineData={sparklineData} />)
    const sparkline = screen.getByTestId('sparkline')
    expect(sparkline).toBeInTheDocument()
    expect(sparkline).toHaveAttribute('data-size', 'inline')
  })

  it('omite sparkline no size compact', () => {
    const sparklineData = [{ date: '2026-03-01', adherence: 80 }]
    render(<RingGauge score={85} streak={7} size="compact" sparklineData={sparklineData} />)
    expect(screen.queryByTestId('sparkline')).not.toBeInTheDocument()
  })

  it('chama onClick ao clicar', () => {
    const onClick = vi.fn()
    const { container } = render(<RingGauge score={85} streak={7} onClick={onClick} />)
    fireEvent.click(container.firstChild)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('adiciona tabindex quando clickable', () => {
    const onClick = vi.fn()
    const { container } = render(<RingGauge score={85} streak={7} onClick={onClick} />)
    expect(container.firstChild).toHaveAttribute('tabindex', '0')
  })

  it('não adiciona tabindex quando não clickable', () => {
    const { container } = render(<RingGauge score={85} streak={7} />)
    expect(container.firstChild).not.toHaveAttribute('tabindex')
  })

  it('aceita className customizado', () => {
    const { container } = render(<RingGauge score={85} streak={7} className="meu-gauge" />)
    expect(container.firstChild).toHaveClass('meu-gauge')
  })
})
