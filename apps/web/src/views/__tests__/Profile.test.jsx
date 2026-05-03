import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: 'user-1',
              email: 'joao@email.com',
              user_metadata: { name: 'Joao Silva' },
            },
          },
        })
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: {
            display_name: 'Joao Silva',
            birth_date: '1990-01-01',
            city: 'São Paulo',
            state: 'SP',
          },
          error: null,
        })
      ),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

vi.mock('@shared/components/ui/Loading', () => ({
  default: () => <div data-testid="loading">Loading...</div>,
}))

vi.mock('@shared/components/ui/Modal', () => ({
  default: ({ children, isOpen }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}))

vi.mock('@features/export/components/ExportDialog', () => ({
  default: ({ isOpen }) => (isOpen ? <div data-testid="export-dialog" /> : null),
}))

vi.mock('@features/reports/components/ReportGenerator', () => ({
  default: () => <div data-testid="report-generator" />,
}))

vi.mock('@features/emergency/services/emergencyCardService', () => {
  const service = {
    load: vi.fn(() =>
      Promise.resolve({
        success: true,
        source: 'remote',
        data: {
          blood_type: 'O+',
          allergies: ['Aspirina'],
          conditions: ['Hipertensão'],
          emergency_contacts: [{ name: 'Maria', phone: '11999999999' }],
        },
      })
    ),
    save: vi.fn().mockResolvedValue({ success: true }),
  }
  return {
    emergencyCardService: service,
    default: service,
  }
})

// Mocks para qrcode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
  },
}))

import Profile from '@/views/redesign/Profile'

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza header com nome e metadados apos carregar', async () => {
    render(<Profile onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Joao Silva')).toBeInTheDocument()
    })
  })

  it('renderiza secoes principais de ferramentas', async () => {
    render(<Profile onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Joao Silva')).toBeInTheDocument()
    })

    expect(screen.getByText(/Ferramentas de Gestão/i)).toBeInTheDocument()
    expect(screen.getByText(/Relatório PDF/i)).toBeInTheDocument()
    expect(screen.getByText(/Exportar Dados/i)).toBeInTheDocument()
  })

  it('navega para health-history ao clicar Historico de Doses', async () => {
    const onNavigate = vi.fn()
    render(<Profile onNavigate={onNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Joao Silva')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Histórico de Doses'))
    expect(onNavigate).toHaveBeenCalledWith('health-history')
  })

  it('abre modal de exportacao ao clicar', async () => {
    render(<Profile onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Exportar Dados')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Exportar Dados'))
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument()
  })
})
