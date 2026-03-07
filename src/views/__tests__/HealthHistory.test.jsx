import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: vi.fn(() => ({
    protocols: [],
    stats: { score: 85, currentStreak: 5 },
    refresh: vi.fn(),
  })),
}))

vi.mock('@shared/services', () => ({
  cachedLogService: {
    getByMonth: vi.fn(() => Promise.resolve({ data: [], total: 0 })),
    getAllPaginated: vi.fn(() => Promise.resolve({ data: [], total: 0, hasMore: false })),
    create: vi.fn(),
    update: vi.fn(),
    createBulk: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@services/api/adherenceService', () => ({
  adherenceService: {
    getAdherenceSummary: vi.fn(() =>
      Promise.resolve({
        overallTaken: 42,
        overallExpected: 50,
        longestStreak: 12,
      })
    ),
    getDailyAdherence: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('@shared/components/ui/Loading', () => ({
  default: ({ text }) => <div data-testid="loading">{text}</div>,
}))

vi.mock('@shared/components/ui/Modal', () => ({
  default: ({ children, isOpen }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}))

vi.mock('@shared/components/log/LogForm', () => ({
  default: () => <div data-testid="log-form" />,
}))

vi.mock('@shared/components/log/LogEntry', () => ({
  default: ({ log }) => <div data-testid="log-entry">{log.medicine?.name}</div>,
}))

vi.mock('@shared/components/ui/CalendarWithMonthCache', () => ({
  default: () => <div data-testid="calendar" />,
}))

vi.mock('@dashboard/components/SparklineAdesao', () => ({
  default: () => <div data-testid="sparkline" />,
}))

import HealthHistory from '../HealthHistory'

describe('HealthHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza loading inicialmente', () => {
    render(<HealthHistory onNavigate={vi.fn()} />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renderiza score de adesao do dashboard context', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument()
    })
  })

  it('renderiza streak atual', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/5d streak/)).toBeInTheDocument()
    })
  })

  it('renderiza botao de voltar para profile', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Minha Saúde/)).toBeInTheDocument()
    })
  })

  it('renderiza calendario', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument()
    })
  })

  it('renderiza stats do mes', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Doses')).toBeInTheDocument()
      expect(screen.getByText('Dias')).toBeInTheDocument()
      expect(screen.getByText('Comprimidos')).toBeInTheDocument()
    })
  })

  it('renderiza botao de registrar dose', async () => {
    render(<HealthHistory onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Registrar Dose/)).toBeInTheDocument()
    })
  })
})
