import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DoseZoneList from '../DoseZoneList'

// Mocks de componentes pesados — isolam a lógica do DoseZoneList
vi.mock('../TreatmentAccordion', () => ({
  default: ({ protocol, children, onBatchRegister }) => (
    <div
      data-testid="treatment-accordion"
      data-protocol-name={protocol.name}
    >
      <button
        data-testid="accordion-batch-btn"
        onClick={onBatchRegister}
      >
        LOTE
      </button>
      {children}
    </div>
  ),
}))

vi.mock('../SwipeRegisterItem', () => ({
  default: ({ medicine, time, onRegister }) => (
    <div
      data-testid="swipe-register-item"
      data-medicine={medicine.name}
      data-time={time}
    >
      <button
        data-testid={`swipe-register-${medicine.id}`}
        onClick={() => onRegister(medicine.id, 1)}
      >
        swipe
      </button>
    </div>
  ),
}))

vi.mock('../BatchRegisterButton', () => ({
  default: ({ label, onClick, pendingCount }) =>
    pendingCount > 0 ? (
      <button data-testid="batch-register-btn" onClick={onClick}>
        {label}
      </button>
    ) : null,
}))

// ─── Helpers ──────────────────────────────────────────────────────

const makeDose = (overrides = {}) => ({
  protocolId: 'proto-1',
  medicineId: 'med-1',
  medicineName: 'Aspirina',
  scheduledTime: '08:00',
  dosagePerIntake: 1,
  treatmentPlanId: null,
  treatmentPlanName: null,
  planBadge: null,
  isRegistered: false,
  registeredAt: null,
  ...overrides,
})

const emptyZones = { late: [], now: [], upcoming: [], later: [], done: [] }

const defaultProps = {
  zones: emptyZones,
  totals: { expected: 0, taken: 0, pending: 0 },
  viewMode: 'time',
  complexityMode: 'moderate',
  onRegisterDose: vi.fn(),
  onBatchRegister: vi.fn(),
  onToggleSelection: vi.fn(),
  selectedDoses: new Set(),
}

afterEach(() => {
  vi.clearAllMocks()
})

// ─── Testes ───────────────────────────────────────────────────────

describe('DoseZoneList', () => {
  it('renderiza secoes para cada zona nao vazia', () => {
    const zones = {
      ...emptyZones,
      late: [makeDose({ protocolId: 'l1', scheduledTime: '07:00' })],
      now: [makeDose({ protocolId: 'n1', scheduledTime: '08:00' })],
    }
    render(<DoseZoneList {...defaultProps} zones={zones} />)
    expect(screen.getByTestId('zone-late')).toBeInTheDocument()
    expect(screen.getByTestId('zone-now')).toBeInTheDocument()
    expect(screen.queryByTestId('zone-upcoming')).toBeNull()
    expect(screen.queryByTestId('zone-later')).toBeNull()
    expect(screen.queryByTestId('zone-done')).toBeNull()
  })

  it('nao renderiza zona quando vazia', () => {
    render(<DoseZoneList {...defaultProps} />)
    expect(screen.queryByTestId('zone-late')).toBeNull()
    expect(screen.queryByTestId('zone-now')).toBeNull()
    expect(screen.queryByTestId('zone-upcoming')).toBeNull()
    expect(screen.queryByTestId('zone-later')).toBeNull()
    expect(screen.queryByTestId('zone-done')).toBeNull()
  })

  it('expande late e now por padrao (conteudo visivel)', () => {
    const zones = {
      ...emptyZones,
      late: [makeDose({ protocolId: 'late-1', scheduledTime: '07:00' })],
      now: [makeDose({ protocolId: 'now-1', scheduledTime: '08:00' })],
    }
    render(<DoseZoneList {...defaultProps} zones={zones} />)
    // Quando expandido, os dose-cards estão no DOM
    expect(screen.getByTestId('dose-card-late-1')).toBeInTheDocument()
    expect(screen.getByTestId('dose-card-now-1')).toBeInTheDocument()
  })

  it('colapsa later por padrao (conteudo nao visivel)', () => {
    const zones = {
      ...emptyZones,
      later: [makeDose({ protocolId: 'later-1', scheduledTime: '22:00' })],
    }
    render(<DoseZoneList {...defaultProps} zones={zones} />)
    // Header visível mas conteúdo não (colapsado = AnimatePresence remove do DOM)
    expect(screen.getByTestId('zone-later')).toBeInTheDocument()
    expect(screen.queryByTestId('dose-card-later-1')).toBeNull()
  })

  it('modo time mostra doses em lista flat com PlanBadge', () => {
    const zones = {
      ...emptyZones,
      now: [
        makeDose({
          protocolId: 'p1',
          medicineName: 'Aspirina',
          treatmentPlanId: 'plan-1',
          treatmentPlanName: 'Cardiovascular',
          planBadge: { emoji: '🫀', color: 'var(--color-error)' },
        }),
        makeDose({
          protocolId: 'p2',
          medicineName: 'Metoprolol',
          scheduledTime: '08:30',
        }),
      ],
    }
    render(<DoseZoneList {...defaultProps} zones={zones} viewMode="time" />)
    expect(screen.getByText('Aspirina')).toBeInTheDocument()
    expect(screen.getByText('Metoprolol')).toBeInTheDocument()
    // PlanBadge mostra title com nome do plano
    expect(screen.getByTitle('Cardiovascular')).toBeInTheDocument()
    // Não deve renderizar accordions no modo time
    expect(screen.queryByTestId('treatment-accordion')).toBeNull()
  })

  it('modo plan agrupa por treatmentPlanId usando TreatmentAccordion', () => {
    const zones = {
      ...emptyZones,
      now: [
        makeDose({ protocolId: 'p1', medicineName: 'Aspirina', treatmentPlanId: 'plan-1', treatmentPlanName: 'Cardio' }),
        makeDose({ protocolId: 'p2', medicineName: 'Metoprolol', scheduledTime: '08:30', treatmentPlanId: 'plan-1', treatmentPlanName: 'Cardio' }),
        makeDose({ protocolId: 'p3', medicineName: 'Vitamina D', scheduledTime: '09:00' }), // avulso
      ],
    }
    render(<DoseZoneList {...defaultProps} zones={zones} viewMode="plan" />)
    // Um accordion para o plano
    expect(screen.getByTestId('treatment-accordion')).toBeInTheDocument()
    // Três SwipeRegisterItems (2 no accordion + 1 avulso)
    expect(screen.getAllByTestId('swipe-register-item')).toHaveLength(3)
  })

  it('chama onRegisterDose ao clicar no botao de registro (modo time)', () => {
    const onRegisterDose = vi.fn()
    const zones = {
      ...emptyZones,
      now: [makeDose({ protocolId: 'proto-42', dosagePerIntake: 2 })],
    }
    render(<DoseZoneList {...defaultProps} zones={zones} onRegisterDose={onRegisterDose} />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar Aspirina/i }))
    expect(onRegisterDose).toHaveBeenCalledWith('proto-42', 2)
  })

  it('chama onBatchRegister ao clicar no BatchRegisterButton da zona now', () => {
    const onBatchRegister = vi.fn()
    const nowDoses = [
      makeDose({ protocolId: 'b1', medicineName: 'Aspirina' }),
      makeDose({ protocolId: 'b2', medicineName: 'Metoprolol', scheduledTime: '08:30' }),
    ]
    const zones = { ...emptyZones, now: nowDoses }
    render(<DoseZoneList {...defaultProps} zones={zones} onBatchRegister={onBatchRegister} />)
    fireEvent.click(screen.getByTestId('batch-register-btn'))
    expect(onBatchRegister).toHaveBeenCalledWith(nowDoses)
  })

  it('complex mode colapsa zona upcoming (nao expande por padrao)', () => {
    const zones = {
      ...emptyZones,
      upcoming: [makeDose({ protocolId: 'up-1', scheduledTime: '12:00' })],
    }
    render(<DoseZoneList {...defaultProps} zones={zones} complexityMode="complex" />)
    // Header presente mas conteúdo colapsado
    expect(screen.getByTestId('zone-upcoming')).toBeInTheDocument()
    expect(screen.queryByTestId('dose-card-up-1')).toBeNull()
  })

  it('expande zona ao clicar no header', () => {
    const zones = {
      ...emptyZones,
      later: [makeDose({ protocolId: 'lat-1', scheduledTime: '22:00' })],
    }
    render(<DoseZoneList {...defaultProps} zones={zones} />)
    // Inicialmente colapsado
    expect(screen.queryByTestId('dose-card-lat-1')).toBeNull()
    // Clicar no header
    fireEvent.click(screen.getByTestId('zone-later').querySelector('.zone-header'))
    // Agora expandido
    expect(screen.getByTestId('dose-card-lat-1')).toBeInTheDocument()
  })
})
