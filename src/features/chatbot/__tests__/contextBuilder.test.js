import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildPatientContext, buildSystemPrompt } from '../services/contextBuilder'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const mockMedicines = [
  {
    id: 'uuid-1',
    name: 'Metformina',
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

const mockStockSummary = [{ medicine_id: 'uuid-1', quantity: 20 }]

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
    expect(result).toContain('Medicamentos ativos: 0')
    expect(result).toContain('Doses registradas hoje: 0')
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
