import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: {
          user: {
            id: 'user-1',
            email: 'joao@email.com',
            user_metadata: { name: 'Joao Silva' },
          },
        },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } })),
        })),
      })),
    })),
  },
  signOut: vi.fn(() => Promise.resolve()),
  updatePassword: vi.fn(() => Promise.resolve()),
}))

vi.mock('@shared/components/ui/Loading', () => ({
  default: () => <div data-testid="loading">Loading...</div>,
}))

vi.mock('@shared/components/ui/Modal', () => ({
  default: ({ children, isOpen }) => isOpen ? <div data-testid="modal">{children}</div> : null,
}))

vi.mock('@features/export/components/ExportDialog', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="export-dialog" /> : null,
}))

vi.mock('@features/reports/components/ReportGenerator', () => ({
  default: () => <div data-testid="report-generator" />,
}))

import Profile from '../Profile'

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage for complexity override
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mr_complexity_override')
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza header com nome e email apos carregar', async () => {
    render(<Profile onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Joao Silva')).toBeInTheDocument()
    })
    expect(screen.getByText('joao@email.com')).toBeInTheDocument()
  })

  it('renderiza secoes principais', async () => {
    render(<Profile onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Joao Silva')).toBeInTheDocument()
    })

    expect(screen.getByText(/Saúde & Histórico/i)).toBeInTheDocument()
    expect(screen.getByText(/Relatórios & Dados/i)).toBeInTheDocument()
    expect(screen.getByText(/Configurações/i)).toBeInTheDocument()
  })

  it('navega para health-history ao clicar Minha Saude', async () => {
    const onNavigate = vi.fn()
    render(<Profile onNavigate={onNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Joao Silva')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Minha Saúde'))
    expect(onNavigate).toHaveBeenCalledWith('health-history')
  })

  it('renderiza botao de logout', async () => {
    render(<Profile onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Joao Silva')).toBeInTheDocument()
    })

    expect(screen.getByText('Sair da Conta')).toBeInTheDocument()
  })
})
