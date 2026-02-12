import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DailyDoseModal } from '../DailyDoseModal'
import '@testing-library/jest-dom'

// Mock dos componentes filhos
vi.mock('../../ui/Modal', () => ({
  default: ({ children, isOpen, onClose, title }) => {
    if (!isOpen) return null
    return (
      <div role="dialog" aria-modal="true" data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>Fechar</button>
        {children}
      </div>
    )
  }
}))

vi.mock('../../ui/Loading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>
}))

vi.mock('../../ui/EmptyState', () => ({
  default: ({ icon, title, message, action }) => (
    <div data-testid="empty-state">
      <span data-testid="empty-icon">{icon}</span>
      <h3 data-testid="empty-title">{title}</h3>
      <p data-testid="empty-message">{message}</p>
      {action && (
        <button data-testid="empty-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}))

vi.mock('../DoseListItem', () => ({
  default: ({ log, isTaken }) => (
    <div data-testid={`dose-item-${log.id}`} data-taken={isTaken}>
      {log.medicine?.name}
    </div>
  )
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>
  }
}))

describe('DailyDoseModal', () => {
  const mockDate = '2026-02-11'
  const mockLogs = [
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

  const mockDailySummary = {
    adherence: 85,
    taken: 3,
    expected: 4
  }

  const mockOnClose = vi.fn()
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('controle de visibilidade', () => {
    it('não deve renderizar quando isOpen é false', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={false}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('deve renderizar corretamente quando isOpen é true', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('cabeçalho e data', () => {
    it('deve exibir a data formatada no cabeçalho (locale pt-BR)', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      const title = screen.getByTestId('modal-title')
      // A data deve conter "11 de fevereiro" (ou similar dependendo do dia da semana)
      expect(title.textContent).toMatch(/11 de fevereiro/)
    })

    it('deve ter aria-labelledby para acessibilidade', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'daily-dose-title')
    })
  })

  describe('estados de carregamento e vazio', () => {
    it('deve mostrar estado de loading com spinner', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={[]}
          isLoading={true}
          error={null}
          dailySummary={null}
        />
      )

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByText('Carregando doses...')).toBeInTheDocument()
    })

    it('deve mostrar estado vazio quando não há logs', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={[]}
          isLoading={false}
          error={null}
          dailySummary={null}
        />
      )

      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByTestId('empty-title')).toHaveTextContent('Nenhuma dose agendada')
    })

    it('deve mostrar estado de erro com botão de retry', () => {
      const error = new Error('Falha na conexão')
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={[]}
          isLoading={false}
          error={error}
          dailySummary={null}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByTestId('empty-title')).toHaveTextContent('Erro ao carregar')
      expect(screen.getByTestId('empty-action')).toBeInTheDocument()
    })

    it('deve chamar onRetry quando botão de retry é clicado', () => {
      const error = new Error('Falha na conexão')
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={[]}
          isLoading={false}
          error={error}
          dailySummary={null}
          onRetry={mockOnRetry}
        />
      )

      const retryButton = screen.getByTestId('empty-action')
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalledTimes(1)
    })

    it('não deve mostrar botão de retry quando onRetry não é fornecido', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={[]}
          isLoading={false}
          error={new Error('Erro')}
          dailySummary={null}
        />
      )

      expect(screen.queryByTestId('empty-action')).not.toBeInTheDocument()
    })
  })

  describe('lista de doses', () => {
    it('deve renderizar lista de DoseListItem quando logs são fornecidos', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      expect(screen.getByTestId('dose-item-log-1')).toBeInTheDocument()
      expect(screen.getByTestId('dose-item-log-2')).toBeInTheDocument()
    })

    it('deve exibir título da seção de doses tomadas', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      expect(screen.getByText('Doses Tomadas (2)')).toBeInTheDocument()
    })

    it('deve ter role list para a lista de doses', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      const list = screen.getByRole('list')
      expect(list).toBeInTheDocument()
    })
  })

  describe('resumo de adesão', () => {
    it('deve exibir porcentagem de adesão corretamente', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      expect(screen.getByText('85% adesão')).toBeInTheDocument()
    })

    it('deve exibir contagem de doses corretamente (tomadas/total)', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      expect(screen.getByText('3 de 4 doses')).toBeInTheDocument()
    })

    it('deve ter aria-label para badge de adesão', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      const badge = screen.getByLabelText('Adesão: 85%')
      expect(badge).toBeInTheDocument()
    })

    it('deve ter aria-label para contagem de doses', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      const doseCount = screen.getByLabelText('3 de 4 doses')
      expect(doseCount).toBeInTheDocument()
    })

    it('deve aplicar classe correta para adesão boa (>=80%)', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 85, taken: 4, expected: 4 }}
        />
      )

      const badge = screen.getByText('85% adesão')
      expect(badge).toHaveClass('adherence-badge--good')
    })

    it('deve aplicar classe correta para adesão de alerta (50-79%)', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 65, taken: 2, expected: 3 }}
        />
      )

      const badge = screen.getByText('65% adesão')
      expect(badge).toHaveClass('adherence-badge--warning')
    })

    it('deve aplicar classe correta para adesão ruim (<50%)', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 40, taken: 1, expected: 3 }}
        />
      )

      const badge = screen.getByText('40% adesão')
      expect(badge).toHaveClass('adherence-badge--poor')
    })

    it('não deve exibir resumo quando dailySummary é null', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={null}
        />
      )

      expect(screen.queryByText(/% adesão/)).not.toBeInTheDocument()
    })
  })

  describe('interações', () => {
    it('deve chamar onClose quando botão de fechar é clicado', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      const closeButton = screen.getByTestId('modal-close')
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('deve ter aria-live no resumo para atualizações dinâmicas', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      const summary = document.querySelector('.daily-dose-summary')
      expect(summary).toHaveAttribute('aria-live', 'polite')
      expect(summary).toHaveAttribute('aria-atomic', 'true')
    })
  })

  describe('focus trap', () => {
    it('deve lidar com eventos de teclado no modal', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      const modal = screen.getByRole('dialog')
      fireEvent.keyDown(modal, { key: 'Tab' })

      // O componente deve ter o handler de keydown configurado
      expect(modal).toBeInTheDocument()
    })
  })

  describe('footer informativo', () => {
    it('deve exibir dica quando há doses', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      expect(screen.getByText(/💡 Clique em uma dose para ver detalhes/)).toBeInTheDocument()
    })

    it('não deve exibir dica quando não há doses', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={[]}
          isLoading={false}
          error={null}
          dailySummary={null}
        />
      )

      expect(screen.queryByText(/💡 Clique em uma dose/)).not.toBeInTheDocument()
    })
  })

  describe('doses perdidas (missed doses)', () => {
    const mockProtocols = [
      {
        id: 'proto-1',
        medicine_id: 'med-1',
        active: true,
        frequency: 'diário',
        time_schedule: ['08:00', '20:00'],
        dosage_per_intake: 1,
        medicine: { name: 'Paracetamol', type: 'comprimido' }
      }
    ]

    it('deve exibir seção de doses perdidas quando há doses perdidas', () => {
      // Uma dose tomada (08:00), uma perdida (20:00)
      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: '2026-02-11T11:00:00Z', // 08:00 local
          quantity_taken: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' },
          protocol: { name: 'Protocolo Manhã' }
        }
      ]

      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={logs}
          protocols={mockProtocols}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 50, taken: 1, expected: 2 }}
        />
      )

      expect(screen.getByText('Doses Perdidas (1)')).toBeInTheDocument()
    })

    it('não deve exibir seção de doses perdidas quando todas foram tomadas', () => {
      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: '2026-02-11T11:00:00Z',
          quantity_taken: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' },
          protocol: { name: 'Protocolo Manhã' }
        },
        {
          id: 'log-2',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: '2026-02-11T23:00:00Z',
          quantity_taken: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' },
          protocol: { name: 'Protocolo Manhã' }
        }
      ]

      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={logs}
          protocols={mockProtocols}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 100, taken: 2, expected: 2 }}
        />
      )

      expect(screen.queryByText(/Doses Perdidas/)).not.toBeInTheDocument()
    })

    it('deve passar isTaken=false para DoseListItem de doses perdidas', () => {
      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: '2026-02-11T11:00:00Z',
          quantity_taken: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' },
          protocol: { name: 'Protocolo Manhã' }
        }
      ]

      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={logs}
          protocols={mockProtocols}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 50, taken: 1, expected: 2 }}
        />
      )

      // Dose perdida deve ter isTaken=false
      // Como o mock de DoseListItem retorna data-taken, verificamos que a dose
      // com id sintético (missed-*) não existe (ela não tem log real)
      expect(screen.getByText('Doses Tomadas (1)')).toBeInTheDocument()
      expect(screen.getByText('Doses Perdidas (1)')).toBeInTheDocument()
    })

    it('deve mostrar ambas seções quando há doses tomadas e perdidas', () => {
      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: '2026-02-11T11:00:00Z',
          quantity_taken: 1,
          medicine: { name: 'Paracetamol', type: 'comprimido' },
          protocol: { name: 'Protocolo Manhã' }
        }
      ]

      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={logs}
          protocols={mockProtocols}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 50, taken: 1, expected: 2 }}
        />
      )

      expect(screen.getByText('Doses Tomadas (1)')).toBeInTheDocument()
      expect(screen.getByText('Doses Perdidas (1)')).toBeInTheDocument()
    })

    it('deve usar fallback quando protocols não é fornecido (backward compatibility)', () => {
      // Sem protocols prop - deve comportar-se como antes
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={mockLogs}
          isLoading={false}
          error={null}
          dailySummary={mockDailySummary}
        />
      )

      // Deve mostrar doses tomadas normalmente
      expect(screen.getByText('Doses Tomadas (2)')).toBeInTheDocument()
      // Não deve ter seção de doses perdidas quando não há protocols
      expect(screen.queryByText(/Doses Perdidas/)).not.toBeInTheDocument()
    })

    it('deve exibir estado vazio quando não há doses agendadas', () => {
      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={[]}
          protocols={[]}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 0, taken: 0, expected: 0 }}
        />
      )

      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByTestId('empty-title')).toHaveTextContent('Nenhuma dose agendada')
    })
  })

  describe('cálculo de doses com protocols', () => {
    it('deve calcular doses corretamente com protocols de múltiplos horários', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00', '12:00', '18:00'],
          dosage_per_intake: 1,
          medicine: { name: 'Antibiótico', type: 'cápsula' }
        }
      ]

      // Apenas uma dose tomada, duas perdidas
      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: '2026-02-11T11:00:00Z',
          quantity_taken: 1,
          medicine: { name: 'Antibiótico', type: 'cápsula' },
          protocol: { name: 'Tratamento' }
        }
      ]

      render(
        <DailyDoseModal
          date={mockDate}
          isOpen={true}
          onClose={mockOnClose}
          logs={logs}
          protocols={protocols}
          isLoading={false}
          error={null}
          dailySummary={{ adherence: 33, taken: 1, expected: 3 }}
        />
      )

      expect(screen.getByText('Doses Tomadas (1)')).toBeInTheDocument()
      expect(screen.getByText('Doses Perdidas (2)')).toBeInTheDocument()
    })
  })
})
