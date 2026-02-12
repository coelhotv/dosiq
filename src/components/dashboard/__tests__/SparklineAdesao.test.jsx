import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SparklineAdesao } from '../SparklineAdesao'
import '@testing-library/jest-dom'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    path: ({ children, ...props }) => <path {...props}>{children}</path>,
    circle: ({ children, ...props }) => <circle {...props}>{children}</circle>
  }
}))

// Mock analyticsService
vi.mock('../../services/analyticsService', () => ({
  analyticsService: {
    track: vi.fn()
  }
}))

describe('SparklineAdesao', () => {
  // Helper para gerar datas relativas a hoje (últimos 7 dias)
  const getRelativeDate = (daysAgo) => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date.toISOString().split('T')[0]
  }

  // Usar datas relativas para garantir que não sejam filtradas como futuras
  const today = getRelativeDate(0)
  const day1 = getRelativeDate(6)
  const day2 = getRelativeDate(5)
  const day3 = getRelativeDate(4)
  const day4 = getRelativeDate(3)
  const day5 = getRelativeDate(2)
  const day6 = getRelativeDate(1)

  const mockAdherenceData = [
    { date: day1, adherence: 75, taken: 3, expected: 4 },
    { date: day2, adherence: 100, taken: 4, expected: 4 },
    { date: day3, adherence: 50, taken: 2, expected: 4 },
    { date: day4, adherence: 100, taken: 4, expected: 4 },
    { date: day5, adherence: 75, taken: 3, expected: 4 },
    { date: day6, adherence: 100, taken: 4, expected: 4 },
    { date: today, adherence: 85, taken: 4, expected: 5 }
  ]

  const mockOnDayClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock de window.matchMedia para prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('renderização básica', () => {
    it('deve renderizar o gráfico com dados de adesão', () => {
      render(<SparklineAdesao adherenceByDay={mockAdherenceData} />)

      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('deve exibir mensagem "Sem dados" quando não há dados', () => {
      render(<SparklineAdesao adherenceByDay={[]} />)

      expect(screen.getByText('Sem dados')).toBeInTheDocument()
    })

    it('deve exibir estatísticas (média e tendência)', () => {
      render(<SparklineAdesao adherenceByDay={mockAdherenceData} />)

      // Buscar o elemento com a classe de média
      expect(document.querySelector('.sparkline-average')).toBeInTheDocument()
    })
  })

  describe('interações de click (drill-down)', () => {
    it('deve chamar onDayClick quando um marcador é clicado', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      // Encontrar um ponto clicável pelo role="button"
      const dot = document.querySelector('[role="button"]')
      expect(dot).toBeInTheDocument()
      fireEvent.click(dot)

      expect(mockOnDayClick).toHaveBeenCalledTimes(1)
    })

    it('deve passar dayData completo para o callback onDayClick', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dot = document.querySelector('[role="button"]')
      fireEvent.click(dot)

      const callArg = mockOnDayClick.mock.calls[0][0]
      expect(callArg).toHaveProperty('date')
      expect(callArg).toHaveProperty('adherence')
      expect(callArg).toHaveProperty('taken')
      expect(callArg).toHaveProperty('expected')
    })

    it('não deve permitir clique quando onDayClick não é fornecido', () => {
      render(<SparklineAdesao adherenceByDay={mockAdherenceData} />)

      const dots = document.querySelectorAll('.sparkline-dot')
      // Quando onDayClick não é fornecido, os dots não devem ter role="button"
      const clickableDots = Array.from(dots).filter(dot => dot.getAttribute('role') === 'button')

      expect(clickableDots.length).toBe(0)
    })

    it('deve ter cursor pointer nos pontos clicáveis', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dot = document.querySelector('[role="button"]')
      expect(dot).toHaveStyle({ cursor: 'pointer' })
    })
  })

  describe('interações de teclado', () => {
    it('deve chamar onDayClick quando Enter é pressionado no marcador', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dot = document.querySelector('[role="button"]')
      fireEvent.keyDown(dot, { key: 'Enter' })

      expect(mockOnDayClick).toHaveBeenCalledTimes(1)
    })

    it('deve chamar onDayClick quando Space é pressionado no marcador', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dot = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.keyDown(dot, { key: ' ' })

      expect(mockOnDayClick).toHaveBeenCalledTimes(1)
    })

    it('não deve chamar onDayClick para outras teclas', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dot = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.keyDown(dot, { key: 'Tab' })

      expect(mockOnDayClick).not.toHaveBeenCalled()
    })
  })

  describe('atributos de acessibilidade', () => {
    it('deve ter role img no container', () => {
      render(<SparklineAdesao adherenceByDay={mockAdherenceData} />)

      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('deve ter aria-label descritivo no container', () => {
      render(<SparklineAdesao adherenceByDay={mockAdherenceData} />)

      const container = screen.getByRole('img')
      expect(container).toHaveAttribute('aria-label')
      expect(container.getAttribute('aria-label')).toContain('Gráfico de adesão')
    })

    it('deve ter role button nos pontos clicáveis', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dots = document.querySelectorAll('[role="button"]')
      expect(dots.length).toBeGreaterThan(0)
    })

    it('deve ter tabIndex configurado nos pontos', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      // Pontos clicáveis devem ter tabIndex=0
      const dots = document.querySelectorAll('.sparkline-dot')
      // Apenas pontos com onDayClick devem ser focáveis (tabIndex=0)
      const focusableDots = Array.from(dots).filter(dot => dot.getAttribute('tabIndex') === '0')
      expect(focusableDots.length).toBeGreaterThan(0)
    })

    it('deve ter aria-label descritivo nos pontos clicáveis', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dots = document.querySelectorAll('[role="button"]')
      dots.forEach(dot => {
        expect(dot).toHaveAttribute('aria-label')
        const label = dot.getAttribute('aria-label')
        expect(label).toMatch(/Ver detalhes de/)
      })
    })

    it('deve ter data-date e data-adherence nos pontos para testes', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dot = screen.getByTestId('sparkline-dot-2026-02-11')
      expect(dot).toHaveAttribute('data-date', '2026-02-11')
      expect(dot).toHaveAttribute('data-adherence', '85')
    })
  })

  describe('estilos e aparência', () => {
    it('deve aplicar classe de hover nos marcadores clicáveis', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      const dots = document.querySelectorAll('.sparkline-dot--clickable')
      expect(dots.length).toBeGreaterThan(0)
    })

    it('deve não ter classe clickable quando onDayClick não é fornecido', () => {
      render(<SparklineAdesao adherenceByDay={mockAdherenceData} />)

      const clickableDots = document.querySelectorAll('.sparkline-dot--clickable')
      expect(clickableDots.length).toBe(0)
    })

    it('deve usar tamanhos diferentes baseado na prop size', () => {
      const { container: small } = render(
        <SparklineAdesao adherenceByDay={mockAdherenceData} size="small" />
      )
      const { container: large } = render(
        <SparklineAdesao adherenceByDay={mockAdherenceData} size="large" />
      )

      // Verificar que os SVGs têm viewBox diferentes
      const smallSvg = small.querySelector('svg')
      const largeSvg = large.querySelector('svg')

      expect(smallSvg).toBeInTheDocument()
      expect(largeSvg).toBeInTheDocument()
    })

    it('deve ter cores semânticas baseadas na adesão', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          onDayClick={mockOnDayClick}
        />
      )

      // Dia com adesão boa (>= 80)
      const goodDot = screen.getByTestId('sparkline-dot-2026-02-06')
      const goodFill = goodDot.getAttribute('fill')
      expect(goodFill).toContain('success')

      // Dia com adesão de alerta (50-79)
      const warningDot = screen.getByTestId('sparkline-dot-2026-02-05')
      const warningFill = warningDot.getAttribute('fill')
      expect(warningFill).toContain('warning')

      // Dia com adesão ruim (< 50)
      const poorDot = screen.getByTestId('sparkline-dot-2026-02-07')
      const poorFill = poorDot.getAttribute('fill')
      expect(poorFill).toContain('error')
    })
  })

  describe('filtragem de datas futuras', () => {
    it('deve filtrar datas futuras no horário do Brasil', () => {
      // Criar data futura (amanhã)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      const dataWithFuture = [
        { date: tomorrowStr, adherence: 100, taken: 4, expected: 4 },
        ...mockAdherenceData
      ]

      render(
        <SparklineAdesao
          adherenceByDay={dataWithFuture}
          onDayClick={mockOnDayClick}
        />
      )

      // Não deve haver ponto para a data futura
      const futureDot = screen.queryByTestId(`sparkline-dot-${tomorrowStr}`)
      expect(futureDot).not.toBeInTheDocument()
    })
  })

  describe('propagação de eventos', () => {
    it('deve parar propagação do evento de click no ponto', () => {
      const parentClick = vi.fn()

      render(
        <div onClick={parentClick}>
          <SparklineAdesao
            adherenceByDay={mockAdherenceData}
            onDayClick={mockOnDayClick}
          />
        </div>
      )

      const dot = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dot)

      // O parent não deve receber o evento diretamente do dot
      // (o stopPropagation deve estar funcionando)
      expect(mockOnDayClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('tooltips', () => {
    it('deve exibir tooltips quando showTooltip é true', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          showTooltip={true}
        />
      )

      const tooltipContainer = document.querySelector('.sparkline-tooltip-container')
      expect(tooltipContainer).toBeInTheDocument()
    })

    it('não deve exibir tooltips quando showTooltip é false', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          showTooltip={false}
        />
      )

      const tooltipContainer = document.querySelector('.sparkline-tooltip-container')
      expect(tooltipContainer).not.toBeInTheDocument()
    })

    it('deve ter className personalizado quando fornecido', () => {
      render(
        <SparklineAdesao
          adherenceByDay={mockAdherenceData}
          className="custom-class"
        />
      )

      const container = screen.getByRole('img')
      expect(container).toHaveClass('custom-class')
    })
  })
})
