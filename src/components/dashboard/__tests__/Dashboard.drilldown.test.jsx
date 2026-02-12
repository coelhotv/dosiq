import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Dashboard from '../../../views/Dashboard'
import '@testing-library/jest-dom'

// Mock dos hooks e serviços
vi.mock('../../../hooks/useDashboardContext', () => ({
  useDashboard: vi.fn()
}))

vi.mock('../../../hooks/useAdherenceTrend', () => ({
  useAdherenceTrend: vi.fn()
}))

vi.mock('../../../hooks/useInsights', () => ({
  useInsights: vi.fn()
}))

vi.mock('../../../hooks/useCachedQuery', () => ({
  useCachedQuery: vi.fn()
}))

vi.mock('../../../lib/supabase', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User' }
  })
}))

vi.mock('../../../services/analyticsService', () => ({
  analyticsService: {
    track: vi.fn()
  }
}))

// Mock dos componentes filhos para simplificar testes
vi.mock('../../ui/Loading', () => ({
  default: ({ text }) => <div data-testid="loading">{text}</div>
}))

vi.mock('../../ui/Modal', () => ({
  default: ({ children, isOpen, onClose }) => {
    if (!isOpen) return null
    return (
      <div data-testid="modal" role="dialog" aria-modal="true">
        <button data-testid="modal-close" onClick={onClose}>Fechar</button>
        {children}
      </div>
    )
  }
}))

vi.mock('../../ui/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />
}))

vi.mock('../../ui/EmptyState', () => ({
  default: ({ title, description }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}))

vi.mock('../HealthScoreCard', () => ({
  default: ({ score, onClick }) => (
    <div data-testid="health-score-card" onClick={onClick}>
      Score: {score}
    </div>
  )
}))

vi.mock('../HealthScoreDetails', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="health-details" /> : null
}))

vi.mock('../SmartAlerts', () => ({
  default: ({ onAction }) => (
    <div data-testid="smart-alerts">
      <button data-testid="alert-action" onClick={() => onAction({}, { label: 'TOMAR' })}>
        Ação
      </button>
    </div>
  )
}))

vi.mock('../InsightCard', () => ({
  default: ({ text }) => <div data-testid="insight-card">{text}</div>
}))

vi.mock('../TreatmentAccordion', () => ({
  default: ({ children }) => <div data-testid="treatment-accordion">{children}</div>
}))

vi.mock('../SwipeRegisterItem', () => ({
  default: ({ onRegister }) => (
    <div data-testid="swipe-register-item">
      <button onClick={onRegister}>Registrar</button>
    </div>
  )
}))

vi.mock('../SparklineAdesao', () => ({
  default: ({ adherenceByDay, onDayClick }) => (
    <div data-testid="sparkline-adesao">
      {adherenceByDay.map(day => (
        <button
          key={day.date}
          data-testid={`sparkline-dot-${day.date}`}
          onClick={() => onDayClick?.(day)}
        >
          {day.adherence}%
        </button>
      ))}
    </div>
  )
}))

vi.mock('../DailyDoseModal', () => ({
  default: ({ date, isOpen, onClose, logs, isLoading, error, dailySummary, onRetry }) => {
    if (!isOpen) return null
    return (
      <div data-testid="daily-dose-modal" data-date={date}>
        <button data-testid="modal-close-btn" onClick={onClose}>Fechar</button>
        {isLoading && <div data-testid="modal-loading">Carregando...</div>}
        {error && (
          <div data-testid="modal-error">
            Erro
            <button data-testid="retry-btn" onClick={onRetry}>Retry</button>
          </div>
        )}
        {!isLoading && !error && (
          <div data-testid="modal-content">
            <div data-testid="modal-summary">
              {dailySummary && (
                <span>{dailySummary.taken} de {dailySummary.expected} doses</span>
              )}
            </div>
            <div data-testid="modal-logs">
              {logs.map(log => (
                <div key={log.id} data-testid={`log-${log.id}`}>
                  {log.medicine?.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
}))

vi.mock('../../gamification/ConfettiAnimation', () => ({
  default: () => null
}))

vi.mock('../../gamification/MilestoneCelebration', () => ({
  default: () => null
}))

vi.mock('../../log/LogForm', () => ({
  default: ({ onSave, onCancel }) => (
    <div data-testid="log-form">
      <button onClick={() => onSave({})}>Salvar</button>
      <button onClick={onCancel}>Cancelar</button>
    </div>
  )
}))

// Mock dos serviços
const mockLogService = {
  getByDateRange: vi.fn()
}

const mockTreatmentPlanService = {
  getAll: vi.fn().mockResolvedValue([])
}

const mockAdherenceService = {
  getDailyAdherence: vi.fn()
}

vi.mock('../../../services/api', () => ({
  cachedLogService: mockLogService,
  cachedTreatmentPlanService: mockTreatmentPlanService,
  adherenceService: mockAdherenceService
}))

describe('Dashboard - Sparkline Drill-Down Integration', () => {
  const mockDailyAdherence = [
    { date: '2026-02-05', adherence: 75, taken: 3, expected: 4 },
    { date: '2026-02-06', adherence: 100, taken: 4, expected: 4 },
    { date: '2026-02-07', adherence: 50, taken: 2, expected: 4 },
    { date: '2026-02-08', adherence: 100, taken: 4, expected: 4 },
    { date: '2026-02-09', adherence: 75, taken: 3, expected: 4 },
    { date: '2026-02-10', adherence: 100, taken: 4, expected: 4 },
    { date: '2026-02-11', adherence: 85, taken: 4, expected: 5 }
  ]

  const mockDayLogs = [
    {
      id: 'log-1',
      taken_at: '2026-02-11T08:30:00Z',
      quantity_taken: 1,
      medicine: { name: 'Paracetamol', type: 'comprimido' },
      protocol: { name: 'Protocolo Manhã' }
    },
    {
      id: 'log-2',
      taken_at: '2026-02-11T14:00:00Z',
      quantity_taken: 2,
      medicine: { name: 'Ibuprofeno', type: 'comprimido' },
      protocol: { name: 'Protocolo Tarde' }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    const { useDashboard } = require('../../../hooks/useDashboardContext')
    useDashboard.mockReturnValue({
      stats: { score: 85, currentStreak: 5 },
      protocols: [],
      logs: [],
      stockSummary: [],
      refresh: vi.fn(),
      isDoseInToleranceWindow: vi.fn().mockReturnValue(false),
      isLoading: false
    })

    const { useAdherenceTrend } = require('../../../hooks/useAdherenceTrend')
    useAdherenceTrend.mockReturnValue({
      trend: 'stable',
      percentage: 0,
      magnitude: 'neutral'
    })

    const { useInsights } = require('../../../hooks/useInsights')
    useInsights.mockReturnValue({
      insight: null,
      loading: false
    })

    // Mock useCachedQuery para drill-down
    const { useCachedQuery } = require('../../../hooks/useCachedQuery')
    useCachedQuery.mockImplementation((key) => {
      // Se for key de drill-down, retornar dados de mock
      if (key && key.startsWith('logs-drilldown-')) {
        return {
          data: { data: mockDayLogs, total: 2, hasMore: false },
          isLoading: false,
          error: null,
          executeQuery: vi.fn()
        }
      }
      return {
        data: null,
        isLoading: false,
        error: null,
        executeQuery: vi.fn()
      }
    })

    mockAdherenceService.getDailyAdherence.mockResolvedValue(mockDailyAdherence)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('abertura do modal', () => {
    it('deve abrir o modal quando um dia do sparkline é clicado', async () => {
      render(<Dashboard onNavigate={vi.fn()} />)

      // Aguardar o sparkline ser renderizado
      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      // Clicar em um dia do sparkline
      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      // Modal deve estar aberto
      await waitFor(() => {
        expect(screen.getByTestId('daily-dose-modal')).toBeInTheDocument()
      })
    })

    it('deve buscar logs para a data selecionada via useCachedQuery', async () => {
      const { useCachedQuery } = require('../../../hooks/useCachedQuery')

      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      // Clicar em um dia
      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      // Verificar que useCachedQuery foi chamado com a key correta
      await waitFor(() => {
        const calls = useCachedQuery.mock.calls
        const drillDownCall = calls.find(call => call[0] && call[0].includes('logs-drilldown-'))
        expect(drillDownCall).toBeTruthy()
        expect(drillDownCall[0]).toBe('logs-drilldown-2026-02-11')
      })
    })

    it('deve passar a data correta para o DailyDoseModal', async () => {
      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      // Clicar em um dia específico
      const dayButton = screen.getByTestId('sparkline-dot-2026-02-10')
      fireEvent.click(dayButton)

      await waitFor(() => {
        const modal = screen.getByTestId('daily-dose-modal')
        expect(modal).toHaveAttribute('data-date', '2026-02-10')
      })
    })
  })

  describe('fechamento do modal', () => {
    it('deve fechar o modal quando o botão de fechar é clicado', async () => {
      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      // Abrir modal
      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      await waitFor(() => {
        expect(screen.getByTestId('daily-dose-modal')).toBeInTheDocument()
      })

      // Fechar modal
      const closeButton = screen.getByTestId('modal-close-btn')
      fireEvent.click(closeButton)

      // Aguardar animação de fechamento
      await waitFor(() => {
        expect(screen.queryByTestId('daily-dose-modal')).not.toBeInTheDocument()
      })
    })
  })

  describe('exibição de dados no modal', () => {
    it('deve exibir dados corretos de doses no modal', async () => {
      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      // Abrir modal
      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      await waitFor(() => {
        expect(screen.getByTestId('daily-dose-modal')).toBeInTheDocument()
      })

      // Verificar que os logs são exibidos
      expect(screen.getByTestId('log-log-1')).toBeInTheDocument()
      expect(screen.getByTestId('log-log-2')).toBeInTheDocument()
    })

    it('deve exibir resumo correto de doses (tomadas/total)', async () => {
      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      await waitFor(() => {
        expect(screen.getByTestId('daily-dose-modal')).toBeInTheDocument()
      })

      // Verificar o resumo
      const summary = screen.getByTestId('modal-summary')
      expect(summary.textContent).toContain('4 de 5 doses')
    })

    it('deve mostrar estado de loading enquanto busca dados', async () => {
      const { useCachedQuery } = require('../../../hooks/useCachedQuery')

      // Mock para retornar loading
      useCachedQuery.mockImplementation((key) => {
        if (key && key.startsWith('logs-drilldown-')) {
          return {
            data: null,
            isLoading: true,
            error: null,
            executeQuery: vi.fn()
          }
        }
        return { data: null, isLoading: false, error: null, executeQuery: vi.fn() }
      })

      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      await waitFor(() => {
        expect(screen.getByTestId('modal-loading')).toBeInTheDocument()
      })
    })

    it('deve mostrar estado de erro quando há falha', async () => {
      const { useCachedQuery } = require('../../../hooks/useCachedQuery')

      // Mock para retornar erro
      useCachedQuery.mockImplementation((key) => {
        if (key && key.startsWith('logs-drilldown-')) {
          return {
            data: null,
            isLoading: false,
            error: new Error('Falha ao carregar'),
            executeQuery: vi.fn()
          }
        }
        return { data: null, isLoading: false, error: null, executeQuery: vi.fn() }
      })

      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      await waitFor(() => {
        expect(screen.getByTestId('modal-error')).toBeInTheDocument()
      })
    })

    it('deve permitir retry quando há erro', async () => {
      const mockExecuteQuery = vi.fn()
      const { useCachedQuery } = require('../../../hooks/useCachedQuery')

      useCachedQuery.mockImplementation((key) => {
        if (key && key.startsWith('logs-drilldown-')) {
          return {
            data: null,
            isLoading: false,
            error: new Error('Falha ao carregar'),
            executeQuery: mockExecuteQuery
          }
        }
        return { data: null, isLoading: false, error: null, executeQuery: vi.fn() }
      })

      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      await waitFor(() => {
        expect(screen.getByTestId('retry-btn')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('retry-btn'))

      expect(mockExecuteQuery).toHaveBeenCalledWith({ force: true })
    })
  })

  describe('sparkline com dados de adesão', () => {
    it('deve passar dados de adesão para o SparklineAdesao', async () => {
      const { useAdherenceTrend } = require('../../../hooks/useAdherenceTrend')
      useAdherenceTrend.mockReturnValue({
        trend: 'up',
        percentage: 15,
        magnitude: 'high'
      })

      const { useDashboard } = require('../../../hooks/useDashboardContext')
      useDashboard.mockReturnValue({
        stats: { score: 85, currentStreak: 5 },
        protocols: [],
        logs: [],
        stockSummary: [],
        refresh: vi.fn(),
        isDoseInToleranceWindow: vi.fn(),
        isLoading: false
      })

      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      // Verificar que todos os dias estão renderizados
      mockDailyAdherence.forEach(day => {
        expect(screen.getByTestId(`sparkline-dot-${day.date}`)).toBeInTheDocument()
      })
    })

    it('deve passar callback onDayClick para SparklineAdesao', async () => {
      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      // Clicar em um dia deve abrir o modal (prova que onDayClick está funcionando)
      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      await waitFor(() => {
        expect(screen.getByTestId('daily-dose-modal')).toBeInTheDocument()
      })
    })
  })

  describe('tracking de analytics', () => {
    it('deve rastrear evento quando drill-down é aberto', async () => {
      const { analyticsService } = require('../../../services/analyticsService')

      render(<Dashboard onNavigate={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByTestId('sparkline-adesao')).toBeInTheDocument()
      })

      const dayButton = screen.getByTestId('sparkline-dot-2026-02-11')
      fireEvent.click(dayButton)

      await waitFor(() => {
        expect(analyticsService.track).toHaveBeenCalledWith(
          'sparkline_drilldown_opened',
          expect.objectContaining({
            date: '2026-02-11',
            adherence: 85
          })
        )
      })
    })
  })
})
