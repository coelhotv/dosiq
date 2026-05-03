import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: vi.fn(() => ({
    protocols: [],
    stats: { score: 85, currentStreak: 5 },
    refresh: vi.fn(),
  })),
}))

vi.mock('@dashboard/hooks/useComplexityMode', () => ({
  useComplexityMode: vi.fn(() => ({
    mode: 'moderate',
    isComplex: false,
    ringGaugeSize: 'medium',
    defaultViewMode: 'time',
  })),
}))

vi.mock('@shared/services', () => ({
  cachedLogService: {
    getByMonthSlim: vi.fn(() => Promise.resolve({ data: [], total: 0 })),
    create: vi.fn(),
    update: vi.fn(),
    createBulk: vi.fn(),
    delete: vi.fn(),
  },
  cachedAdherenceService: {
    getDailyAdherenceFromView: vi.fn(() => Promise.resolve([])),
    getAdherencePatternFromView: vi.fn(() => Promise.resolve(null)),
  },
}))

vi.mock('@shared/components/ui/Calendar', () => ({
  default: () => <div data-testid="calendar" />,
}))

vi.mock('@/views/redesign/history/HistoryKPICards', () => ({
  default: ({ adherenceScore }) => <div data-testid="kpi-cards">{adherenceScore}%</div>,
}))

vi.mock('@/views/redesign/history/HistoryDayPanel', () => ({
  default: () => <div data-testid="day-panel" />,
}))

vi.mock('@shared/components/ui/Modal', () => ({
  default: ({ children, isOpen }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}))

vi.mock('@shared/components/log/LogForm', () => ({
  default: () => <div data-testid="log-form" />,
}))

import HealthHistory from '@/views/redesign/HealthHistory'

describe('HealthHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza loading inicialmente', () => {
    render(<HealthHistory onNavigate={vi.fn()} />)
    expect(screen.getByText(/Carregando histórico.../i)).toBeInTheDocument()
  })

  it('renderiza score de adesao e titulo apos carregar', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Histórico de Doses')).toBeInTheDocument()
      expect(screen.getByTestId('kpi-cards')).toHaveTextContent('85%')
    })
  })

  it('renderiza botao de voltar para profile', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Voltar/)).toBeInTheDocument()
    })
  })

  it('renderiza calendario e painel do dia', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument()
      expect(screen.getByTestId('day-panel')).toBeInTheDocument()
    })
  })
})
