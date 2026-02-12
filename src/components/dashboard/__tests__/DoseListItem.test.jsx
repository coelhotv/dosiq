import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DoseListItem } from '../DoseListItem'
import '@testing-library/jest-dom'

// Mock framer-motion para evitar animações em testes
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>
  }
}))

describe('DoseListItem', () => {
  const mockLog = {
    id: 'log-1',
    taken_at: '2026-02-11T08:30:00Z',
    quantity_taken: 2,
    medicine: {
      name: 'Paracetamol',
      type: 'comprimido'
    },
    protocol: {
      name: 'Protocolo Manhã'
    }
  }

  describe('renderização básica', () => {
    it('deve renderizar corretamente com status de dose tomada (ícone verde)', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      const item = screen.getByTestId('dose-list-item-log-1')
      expect(item).toBeInTheDocument()
      expect(item).toHaveClass('dose-list-item--taken')

      const icon = item.querySelector('.dose-status-icon')
      expect(icon).toHaveClass('dose-status-icon--taken')
      expect(icon).toHaveTextContent('✓')
    })

    it('deve renderizar corretamente com status de dose perdida (ícone vermelho)', () => {
      render(<DoseListItem log={mockLog} isTaken={false} scheduledTime="08:00" index={0} />)

      const item = screen.getByTestId('dose-list-item-log-1')
      expect(item).toBeInTheDocument()
      expect(item).toHaveClass('dose-list-item--missed')

      const icon = item.querySelector('.dose-status-icon')
      expect(icon).toHaveClass('dose-status-icon--missed')
      expect(icon).toHaveTextContent('✕')
    })

    it('deve exibir o nome do medicamento corretamente', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      expect(screen.getByText('Paracetamol')).toBeInTheDocument()
    })

    it('deve exibir o horário previsto no formato correto', () => {
      render(<DoseListItem log={mockLog} isTaken={false} scheduledTime="08:00" index={0} />)

      expect(screen.getByText('08:00')).toBeInTheDocument()
    })

    it('deve exibir o horário real quando dose foi tomada', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      // O horário deve estar presente (o formato exato depende do timezone)
      const timeElement = screen.getByLabelText(/Tomada às/)
      expect(timeElement).toBeInTheDocument()
    })

    it('deve exibir a quantidade da dose no plural correto', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      expect(screen.getByText('2 comprimidos')).toBeInTheDocument()
    })

    it('deve exibir a quantidade da dose no singular quando for 1', () => {
      const singleLog = { ...mockLog, quantity_taken: 1 }
      render(<DoseListItem log={singleLog} isTaken={true} index={0} />)

      expect(screen.getByText('1 comprimido')).toBeInTheDocument()
    })
  })

  describe('formatação de nomes', () => {
    it('deve truncar nomes de medicamentos muito longos', () => {
      const longNameLog = {
        ...mockLog,
        medicine: { ...mockLog.medicine, name: 'Nome de Medicamento Muito Longo Que Excede o Limite de Caracteres' }
      }
      render(<DoseListItem log={longNameLog} isTaken={true} index={0} />)

      // O nome truncado deve estar presente com "..."
      const nameElement = screen.getByText('Nome de Medicamento Muito L...')
      expect(nameElement).toBeInTheDocument()
    })

    it('deve exibir "Remédio" quando o nome do medicamento está ausente', () => {
      const noNameLog = {
        ...mockLog,
        medicine: { ...mockLog.medicine, name: null }
      }
      render(<DoseListItem log={noNameLog} isTaken={true} index={0} />)

      expect(screen.getByText('Remédio')).toBeInTheDocument()
    })

    it('deve usar "cápsula" como unidade quando o tipo for cápsula', () => {
      const capsuleLog = {
        ...mockLog,
        medicine: { ...mockLog.medicine, type: 'cápsula' }
      }
      render(<DoseListItem log={capsuleLog} isTaken={true} index={0} />)

      expect(screen.getByText('2 cápsulas')).toBeInTheDocument()
    })
  })

  describe('tratamento de dados ausentes', () => {
    it('deve lidar com protocolo ausente exibindo "Protocolo" padrão', () => {
      const noProtocolLog = {
        ...mockLog,
        protocol: null
      }
      render(<DoseListItem log={noProtocolLog} isTaken={true} index={0} />)

      expect(screen.getByText('Protocolo')).toBeInTheDocument()
    })

    it('deve exibir "--:--" quando o horário não está disponível', () => {
      const noTimeLog = {
        ...mockLog,
        taken_at: null
      }
      render(<DoseListItem log={noTimeLog} isTaken={false} index={0} />)

      expect(screen.getByText('--:--')).toBeInTheDocument()
    })

    it('deve usar quantidade padrão de 1 quando não especificada', () => {
      const noQuantityLog = {
        ...mockLog,
        quantity_taken: null
      }
      render(<DoseListItem log={noQuantityLog} isTaken={true} index={0} />)

      expect(screen.getByText('1 comprimido')).toBeInTheDocument()
    })

    it('deve lidar com dados de medicamento ausentes', () => {
      const noMedicineLog = {
        ...mockLog,
        medicine: null
      }
      render(<DoseListItem log={noMedicineLog} isTaken={true} index={0} />)

      expect(screen.getByText('Remédio')).toBeInTheDocument()
    })
  })

  describe('acessibilidade', () => {
    it('deve ter role listitem para acessibilidade', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      const item = screen.getByTestId('dose-list-item-log-1')
      expect(item).toHaveAttribute('role', 'listitem')
    })

    it('deve ter aria-label correto para quantidade', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      const quantityElement = screen.getByLabelText('Quantidade: 2 comprimidos')
      expect(quantityElement).toBeInTheDocument()
    })

    it('deve ter aria-label indicando status de tomada', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      const timeElement = screen.getByLabelText(/Tomada às/)
      expect(timeElement).toBeInTheDocument()
    })

    it('deve ter aria-label indicando status de perdida', () => {
      render(<DoseListItem log={mockLog} isTaken={false} scheduledTime="08:00" index={0} />)

      const timeElement = screen.getByLabelText(/Prevista para/)
      expect(timeElement).toBeInTheDocument()
    })

    it('deve ter aria-hidden no ícone de status', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      const iconContainer = document.querySelector('.dose-list-item__status')
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('interação', () => {
    it('deve chamar onClick quando o item é clicado', () => {
      const handleClick = vi.fn()
      render(<DoseListItem log={mockLog} isTaken={true} onClick={handleClick} index={0} />)

      const item = screen.getByTestId('dose-list-item-log-1')
      item.click()

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('deve exibir label "Tomada" quando isTaken é true', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      expect(screen.getByText('Tomada')).toBeInTheDocument()
    })

    it('deve exibir label "Perdida" quando isTaken é false', () => {
      render(<DoseListItem log={mockLog} isTaken={false} scheduledTime="08:00" index={0} />)

      expect(screen.getByText('Perdida')).toBeInTheDocument()
    })
  })

  describe('animação', () => {
    it('deve ter data-testid único baseado no ID do log', () => {
      render(<DoseListItem log={mockLog} isTaken={true} index={0} />)

      expect(screen.getByTestId('dose-list-item-log-1')).toBeInTheDocument()
    })
  })
})
