import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HealthScoreCard } from '../HealthScoreCard'
import '@testing-library/jest-dom'

// Mock do useDashboardContext
vi.mock('../../../hooks/useDashboardContext', () => ({
  useDashboardContext: vi.fn()
}))

describe('HealthScoreCard', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render health score with correct value', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      healthScore: 85,
      loading: false
    })

    render(<HealthScoreCard onClick={mockOnClick} />)

    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('Score de Saúde')).toBeInTheDocument()
  })

  it('should display correct score label based on value', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    
    // Test excellent score
    useDashboardContext.mockReturnValue({
      healthScore: 95,
      loading: false
    })
    render(<HealthScoreCard onClick={mockOnClick} />)
    expect(screen.getByText('Excelente')).toBeInTheDocument()

    // Test good score
    useDashboardContext.mockReturnValue({
      healthScore: 75,
      loading: false
    })
    render(<HealthScoreCard onClick={mockOnClick} />)
    expect(screen.getByText('Bom')).toBeInTheDocument()

    // Test fair score
    useDashboardContext.mockReturnValue({
      healthScore: 55,
      loading: false
    })
    render(<HealthScoreCard onClick={mockOnClick} />)
    expect(screen.getByText('Regular')).toBeInTheDocument()

    // Test poor score
    useDashboardContext.mockReturnValue({
      healthScore: 35,
      loading: false
    })
    render(<HealthScoreCard onClick={mockOnClick} />)
    expect(screen.getByText('Atenção')).toBeInTheDocument()
  })

  it('should show loading state when loading', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      healthScore: null,
      loading: true
    })

    render(<HealthScoreCard onClick={mockOnClick} />)

    expect(screen.getByText('Calculando...')).toBeInTheDocument()
  })

  it('should show no data state when score is null', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      healthScore: null,
      loading: false
    })

    render(<HealthScoreCard onClick={mockOnClick} />)

    expect(screen.getByText('--')).toBeInTheDocument()
  })

  it('should call onClick when card is clicked', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      healthScore: 75,
      loading: false
    })

    render(<HealthScoreCard onClick={mockOnClick} />)

    const card = screen.getByTestId('health-score-card')
    fireEvent.click(card)

    expect(mockOnClick).toHaveBeenCalled()
  })

  it('should display score breakdown when clicking on details', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      healthScore: 80,
      scoreBreakdown: {
        adherence: 90,
        stock: 70,
        consistency: 80
      },
      loading: false
    })

    render(<HealthScoreCard onClick={mockOnClick} />)

    // Click to expand
    const expandButton = screen.getByLabelText('Ver detalhes')
    fireEvent.click(expandButton)

    expect(screen.getByText('Adesão: 90%')).toBeInTheDocument()
    expect(screen.getByText('Estoque: 70%')).toBeInTheDocument()
    expect(screen.getByText('Consistência: 80%')).toBeInTheDocument()
  })

  it('should render progress bar with correct width', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    useDashboardContext.mockReturnValue({
      healthScore: 75,
      loading: false
    })

    render(<HealthScoreCard onClick={mockOnClick} />)

    const progressBar = screen.getByTestId('health-score-progress')
    expect(progressBar).toHaveStyle({ width: '75%' })
  })

  it('should apply correct color class based on score', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    
    // Test green for high score
    useDashboardContext.mockReturnValue({
      healthScore: 85,
      loading: false
    })
    render(<HealthScoreCard onClick={mockOnClick} />)
    expect(screen.getByTestId('health-score-card')).toHaveClass('score-excellent')

    // Test yellow for medium score
    useDashboardContext.mockReturnValue({
      healthScore: 55,
      loading: false
    })
    render(<HealthScoreCard onClick={mockOnClick} />)
    expect(screen.getByTestId('health-score-card')).toHaveClass('score-fair')

    // Test red for low score
    useDashboardContext.mockReturnValue({
      healthScore: 35,
      loading: false
    })
    render(<HealthScoreCard onClick={mockOnClick} />)
    expect(screen.getByTestId('health-score-card')).toHaveClass('score-poor')
  })
})

describe('HealthScoreCard - Score Categories', () => {
  it('should display correct emoji for score range', () => {
    const { useDashboardContext } = require('../../../hooks/useDashboardContext')
    
    const testCases = [
      { score: 100, emoji: '🌟' },
      { score: 90, emoji: '🌟' },
      { score: 80, emoji: '😊' },
      { score: 70, emoji: '🙂' },
      { score: 60, emoji: '😐' },
      { score: 50, emoji: '😟' },
      { score: 40, emoji: '⚠️' },
      { score: 20, emoji: '🚨' }
    ]

    testCases.forEach(({ score, emoji }) => {
      useDashboardContext.mockReturnValue({
        healthScore: score,
        loading: false
      })

      const { container } = render(<HealthScoreCard onClick={() => {}} />)
      const emojiElement = container.querySelector('.score-emoji')
      expect(emojiElement.textContent).toBe(emoji)
    })
  })
})
