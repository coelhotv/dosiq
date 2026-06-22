import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildPatientContext, buildSystemPrompt } from '@/features/chatbot/services/contextBuilder'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const mockMedicines = [
  {
    id: 'uuid-1',
    name: 'Metformina',
    active_ingredient: 'Cloridrato de Metformina',
    therapeutic_class: 'Antidiabetico',
    dosage_per_pill: 500,
    dosage_unit: 'mg',
    stock: [{ quantity: 20 }],
  },
]

const mockProtocols = [
  {
    medicine_id: 'uuid-1',
    active: true,
    frequency: 'diario',
    time_schedule: ['08:00', '20:00'],
  },
]

const mockLogs = [
  { taken_at: new Date().toISOString() }, // hoje
]

const mockStockSummary = [
  { medicine: { id: 'uuid-1' }, total: 20, daysRemaining: 40, dailyIntake: 1, isLow: false, isZero: false },
]

const mockStats = { adherence: 0.85 }

describe('buildPatientContext', () => {
  it('monta contexto com medicamentos ativos', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: mockLogs,
      stockSummary: mockStockSummary,
      stats: mockStats,
    })
    expect(result).toContain('Metformina')
    expect(result).toContain('diario')
  })

  it('inclui horarios do protocolo', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
    })
    expect(result).toContain('08:00')
    expect(result).toContain('20:00')
  })

  it('inclui estoque via stockSummary', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
    })
    expect(result).toContain('20 un.')
  })

  it('inclui adesao 7d quando disponivel', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: mockStockSummary,
      stats: { adherence: 0.92 },
    })
    expect(result).toContain('92%')
  })

  it('inclui principio ativo e classe terapeutica quando disponiveis', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
    })
    expect(result).toContain('Cloridrato de Metformina')
    expect(result).toContain('Antidiabetico')
  })

  it('omite campos ausentes sem expor null ou undefined no contexto', () => {
    const medSemInfo = [{ ...mockMedicines[0], active_ingredient: null, therapeutic_class: null }]
    const result = buildPatientContext({
      medicines: medSemInfo,
      protocols: mockProtocols,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
    })
    expect(result).toContain('Metformina')
    expect(result).not.toContain('null')
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('[]')
  })

  it('nao inclui IDs ou UUIDs', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: mockLogs,
      stockSummary: mockStockSummary,
      stats: mockStats,
    })
    expect(result).not.toContain('uuid-1')
  })

  it('retorna string com menos de 2000 caracteres', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: mockLogs,
      stockSummary: mockStockSummary,
      stats: mockStats,
    })
    expect(result.length).toBeLessThan(2000)
  })

  it('lida com dados vazios (sem medicamentos)', () => {
    const result = buildPatientContext({
      medicines: [],
      protocols: [],
      logs: [],
      stockSummary: [],
      stats: null,
    })
    expect(result).toContain('Tratamentos ativos: 0')
    expect(result).toContain('Doses registradas hoje: 0')
  })

  it('inclui consumo diario e dias restantes (relativo)', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
    })
    expect(result).toContain('consumo ~1/dia')
    expect(result).toContain('40 dias restantes')
  })

  it('exclui tratamento FINALIZADO (end_date passado) do contexto de estoque', () => {
    const finishedProtocol = [
      { medicine_id: 'uuid-1', active: true, frequency: 'diario', time_schedule: ['08:00'], end_date: '2020-01-01' },
    ]
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: finishedProtocol,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
    })
    expect(result).not.toContain('Metformina')
    expect(result).toContain('Tratamentos ativos: 0')
  })

  it('exclui tratamento PAUSADO (active=false) do contexto', () => {
    const pausedProtocol = [
      { medicine_id: 'uuid-1', active: false, frequency: 'diario', time_schedule: ['08:00'] },
    ]
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: pausedProtocol,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
    })
    expect(result).not.toContain('Metformina')
  })

  it('sem doses materializadas → "Nenhuma dose pendente para hoje"', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
      doseInstances: [],
    })
    expect(result).toContain('Nenhuma dose pendente para hoje')
  })
})

describe('buildSystemPrompt', () => {
  it('inclui regras absolutas no prompt', () => {
    const result = buildSystemPrompt('contexto teste')
    expect(result).toContain('REGRAS ABSOLUTAS')
    expect(result).toContain('NUNCA')
  })

  it('inclui contexto do paciente', () => {
    const result = buildSystemPrompt('Metformina 500mg')
    expect(result).toContain('Metformina 500mg')
    expect(result).toContain('DADOS DO PACIENTE')
  })
})
