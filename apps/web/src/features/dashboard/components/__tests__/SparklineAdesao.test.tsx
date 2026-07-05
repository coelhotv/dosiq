import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SparklineAdesao } from '@/features/dashboard/components/SparklineAdesao'

vi.mock('@dashboard/services/analyticsService', () => ({
  analyticsService: { track: vi.fn() },
}))

afterEach(() => {
  vi.clearAllMocks()
})

// Gera dados de adesão para os últimos N dias
function makeData(days, adherence = 80) {
  const data = []
  const today = new Date()
  // O componente busca de -days até -1 (exclui hoje)
  for (let i = days; i >= 1; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    data.push({
      date: d.toISOString().split('T')[0],
      adherence,
      taken: Math.round((adherence / 100) * 4),
      expected: 4,
    })
  }
  return data
}

describe('SparklineAdesao — renderização base', () => {
  it('renderiza sem dados — exibe estado vazio', () => {
    render(<SparklineAdesao adherenceByDay={[]} />)
    expect(screen.getByRole('img', { name: /sem dados/i })).toBeInTheDocument()
  })

  it('renderiza com dados — exibe gráfico', () => {
    render(<SparklineAdesao adherenceByDay={makeData(7)} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('exibe badge de estatística com média', () => {
    const { container } = render(<SparklineAdesao adherenceByDay={makeData(7, 80)} />)
    const statsAvg = container.querySelector('.sparkline-average')
    expect(statsAvg).toBeInTheDocument()
    expect(statsAvg.textContent).toBe('80%')
  })
})

describe('SparklineAdesao — size inline', () => {
  it('renderiza no size inline sem stats', () => {
    render(<SparklineAdesao adherenceByDay={makeData(7)} size="inline" />)
    const container = screen.getByRole('img')
    expect(container.className).toContain('sparkline-adhesion--inline')
  })

  it('não renderiza dots no size inline', () => {
    render(<SparklineAdesao adherenceByDay={makeData(7)} size="inline" />)
    // No inline, dataPoints is empty (showDots=false), so no circle elements with data-testid
    const dots = document.querySelectorAll('[data-testid^="sparkline-dot-"]')
    expect(dots.length).toBe(0)
  })

  it('não renderiza tooltip container no size inline', () => {
    render(<SparklineAdesao adherenceByDay={makeData(7)} size="inline" />)
    expect(document.querySelector('.sparkline-tooltip-container')).toBeNull()
  })
})

describe('SparklineAdesao — size expanded (30 pontos)', () => {
  it('renderiza com 30 pontos de dados', () => {
    const data = makeData(30, 85)
    render(<SparklineAdesao adherenceByDay={data} size="expanded" />)
    // Deve ter dots para os 30 dias
    const dots = document.querySelectorAll('[data-testid^="sparkline-dot-"]')
    expect(dots.length).toBe(30)
  })

  it('oculta tooltip container no size expanded', () => {
    render(<SparklineAdesao adherenceByDay={makeData(30)} size="expanded" showTooltip={false} />)
    expect(document.querySelector('.sparkline-tooltip-container')).toBeNull()
  })
})

describe('SparklineAdesao — tooltip interativo', () => {
  it('exibe tooltip ao clicar em um dot', () => {
    const data = makeData(7, 85)
    render(<SparklineAdesao adherenceByDay={data} size="medium" showTooltip />)
    const firstDot = document.querySelector('[data-testid^="sparkline-dot-"]')
    expect(firstDot).toBeTruthy()
    fireEvent.click(firstDot)
    // Deve aparecer um tooltip SVG overlay
    expect(document.querySelector('.sparkline-tooltip-overlay')).toBeInTheDocument()
  })

  it('fecha tooltip ao clicar fora', () => {
    const data = makeData(7, 85)
    const { container } = render(
      <SparklineAdesao adherenceByDay={data} size="medium" showTooltip />
    )
    const firstDot = document.querySelector('[data-testid^="sparkline-dot-"]')
    fireEvent.click(firstDot)
    expect(document.querySelector('.sparkline-tooltip-overlay')).toBeInTheDocument()
    // Clicar fora (no container)
    fireEvent.click(container.firstChild)
    expect(document.querySelector('.sparkline-tooltip-overlay')).not.toBeInTheDocument()
  })
})

describe('SparklineAdesao — drill-down (funcionalidade existente)', () => {
  it('chama onDayClick ao clicar num dot', () => {
    const onDayClick = vi.fn()
    const data = makeData(7, 80)
    render(<SparklineAdesao adherenceByDay={data} size="medium" onDayClick={onDayClick} />)
    const firstDot = document.querySelector('[data-testid^="sparkline-dot-"]')
    fireEvent.click(firstDot)
    expect(onDayClick).toHaveBeenCalledTimes(1)
  })

  it('passa os dados corretos para onDayClick', async () => {
    const onDayClick = vi.fn()
    const data = makeData(7, 75)
    render(<SparklineAdesao adherenceByDay={data} size="medium" onDayClick={onDayClick} />)
    const dots = document.querySelectorAll('[data-testid^="sparkline-dot-"]')
    fireEvent.click(dots[0])
    await waitFor(() => {
      expect(onDayClick).toHaveBeenCalledWith(
        expect.objectContaining({ adherence: 75, taken: 3, expected: 4 })
      )
    })
  })
})

describe('SparklineAdesao — acessibilidade', () => {
  it('tem role="img" no container', () => {
    render(<SparklineAdesao adherenceByDay={makeData(7)} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('dots têm aria-label descritivo', () => {
    render(<SparklineAdesao adherenceByDay={makeData(7, 80)} size="medium" />)
    const dots = document.querySelectorAll('[role="button"]')
    expect(dots.length).toBeGreaterThan(0)
    expect(dots[0]).toHaveAttribute('aria-label')
  })
})
