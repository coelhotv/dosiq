import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrescriptionTimeline from '@/features/stock/components/PrescriptionTimeline'

// Hoje fixo: 2026-03-05 (evita flakiness por data real)
vi.mock('@utils/dateUtils', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getTodayLocal: vi.fn(() => '2026-03-05') }
})

afterEach(() => {
  vi.clearAllMocks()
})

// Fixtures
const vigente = {
  name: 'Losartana 50mg',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'vigente',
  daysRemaining: 301,
}

const vencendo = {
  name: 'Metformina',
  startDate: '2025-06-01',
  endDate: '2026-03-20',
  status: 'vencendo',
  daysRemaining: 15,
}

const vencida = {
  name: 'Omeprazol',
  startDate: '2025-01-01',
  endDate: '2026-01-31',
  status: 'vencida',
  daysRemaining: -33,
}

const continua = {
  name: 'Vitamina D',
  startDate: '2025-01-01',
  endDate: null,
  status: 'vigente',
  daysRemaining: null,
}

describe('PrescriptionTimeline — renderização base', () => {
  it('exibe o nome do protocolo', () => {
    render(<PrescriptionTimeline {...vigente} />)
    expect(screen.getByText('Losartana 50mg')).toBeInTheDocument()
  })

  it('exibe dias restantes para prescrição vigente', () => {
    render(<PrescriptionTimeline {...vigente} />)
    expect(screen.getByText('301d restantes')).toBeInTheDocument()
  })

  it('exibe dias vencendo', () => {
    render(<PrescriptionTimeline {...vencendo} />)
    expect(screen.getByText('15d restantes')).toBeInTheDocument()
  })

  it('exibe label "Vencida há Nd" para prescrição expirada', () => {
    render(<PrescriptionTimeline {...vencida} />)
    expect(screen.getByText('Vencida há 33d')).toBeInTheDocument()
  })

  it('exibe "Contínuo" e "Sem vencimento" quando endDate=null', () => {
    render(<PrescriptionTimeline {...continua} />)
    expect(screen.getByText('Contínuo')).toBeInTheDocument()
    expect(screen.getByText('Sem vencimento')).toBeInTheDocument()
  })

  it('exibe datas formatadas DD/MM/YYYY', () => {
    render(<PrescriptionTimeline {...vigente} />)
    expect(screen.getByText('01/01/2026')).toBeInTheDocument()
    expect(screen.getByText('31/12/2026')).toBeInTheDocument()
  })
})

describe('PrescriptionTimeline — cores por status', () => {
  it('badge tem data-status="vigente"', () => {
    const { container } = render(<PrescriptionTimeline {...vigente} />)
    expect(container.querySelector('[data-status="vigente"]')).toBeTruthy()
  })

  it('badge tem data-status="vencendo"', () => {
    const { container } = render(<PrescriptionTimeline {...vencendo} />)
    expect(container.querySelector('[data-status="vencendo"]')).toBeTruthy()
  })

  it('badge tem data-status="vencida"', () => {
    const { container } = render(<PrescriptionTimeline {...vencida} />)
    expect(container.querySelector('[data-status="vencida"]')).toBeTruthy()
  })
})

describe('PrescriptionTimeline — estados visuais', () => {
  it('aplica pulse-critical quando vencida', () => {
    const { container } = render(<PrescriptionTimeline {...vencida} />)
    expect(container.querySelector('[data-testid="prescription-timeline"]').className).toContain(
      'pulse-critical'
    )
  })

  it('não aplica pulse-critical quando vigente', () => {
    const { container } = render(<PrescriptionTimeline {...vigente} />)
    expect(
      container.querySelector('[data-testid="prescription-timeline"]').className
    ).not.toContain('pulse-critical')
  })

  it('exibe marcador "hoje" quando prescrição está em andamento', () => {
    const { container } = render(<PrescriptionTimeline {...vigente} />)
    expect(container.querySelector('.prescription-timeline__today-marker')).toBeTruthy()
  })

  it('não exibe marcador "hoje" quando prescrição está vencida', () => {
    const { container } = render(<PrescriptionTimeline {...vencida} />)
    expect(container.querySelector('.prescription-timeline__today-marker')).toBeNull()
  })

  it('não exibe marcador "hoje" em prescrição contínua', () => {
    const { container } = render(<PrescriptionTimeline {...continua} />)
    expect(container.querySelector('.prescription-timeline__today-marker')).toBeNull()
  })

  it('exibe segmento futuro para prescrição em andamento', () => {
    const { container } = render(<PrescriptionTimeline {...vigente} />)
    expect(container.querySelector('.prescription-timeline__future')).toBeTruthy()
  })

  it('não exibe segmento futuro para prescrição vencida', () => {
    const { container } = render(<PrescriptionTimeline {...vencida} />)
    expect(container.querySelector('.prescription-timeline__future')).toBeNull()
  })
})

describe('PrescriptionTimeline — interatividade', () => {
  it('chama onPress ao clicar', () => {
    const onPress = vi.fn()
    render(<PrescriptionTimeline {...vigente} onPress={onPress} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('chama onPress ao pressionar Enter', () => {
    const onPress = vi.fn()
    render(<PrescriptionTimeline {...vigente} onPress={onPress} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('não tem role="button" sem onPress', () => {
    render(<PrescriptionTimeline {...vigente} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('aceita className personalizado', () => {
    const { container } = render(<PrescriptionTimeline {...vigente} className="minha-classe" />)
    expect(container.querySelector('[data-testid="prescription-timeline"]').className).toContain(
      'minha-classe'
    )
  })
})

describe('PrescriptionTimeline — acessibilidade', () => {
  it('tem aria-label com nome e status quando clicável', () => {
    render(<PrescriptionTimeline {...vigente} onPress={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label', expect.stringContaining('Losartana 50mg'))
    expect(btn).toHaveAttribute('aria-label', expect.stringContaining('301d restantes'))
  })

  it('barra de progresso tem aria-hidden', () => {
    const { container } = render(<PrescriptionTimeline {...vigente} />)
    expect(container.querySelector('.prescription-timeline__track')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })
})
