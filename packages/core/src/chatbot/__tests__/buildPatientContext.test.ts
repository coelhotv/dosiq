import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildPatientContext } from '../buildPatientContext'

// Builder canônico do core (spec 015 onda 1a) — porta os testes do antigo
// contextBuilder.test.js (web) + failure modes degenerados (C1.5).

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
  { medicine_id: 'uuid-1', active: true, frequency: 'diario', time_schedule: ['08:00', '20:00'] },
]

const mockLogs = [{ taken_at: new Date().toISOString() }] // hoje

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
    expect(result).toContain('20 unidades')
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

  it('inclui consumo diario e dias restantes (relativo)', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: mockStockSummary,
      stats: null,
    })
    expect(result).toContain('consumo ~1 un./dia')
    expect(result).toContain('40 dias restantes')
  })

  it('exclui tratamento FINALIZADO (end_date passado) do contexto', () => {
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

  // -- Failure modes degenerados (C1.5) --

  it('não lança com argumento totalmente ausente (undefined)', () => {
    expect(() => buildPatientContext()).not.toThrow()
    const result = buildPatientContext()
    expect(result).toContain('Tratamentos ativos: 0')
  })

  it('não lança com arrays null', () => {
    const result = buildPatientContext({
      medicines: null,
      protocols: null,
      logs: null,
      stockSummary: null,
      stats: null,
      doseInstances: null,
    })
    expect(result).toContain('Tratamentos ativos: 0')
    expect(result).toContain('Doses registradas hoje: 0')
  })

  it('daysRemaining Infinity → omite linha de dias restantes', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: [{ medicine: { id: 'uuid-1' }, total: 20, daysRemaining: Infinity, dailyIntake: 0, isZero: false }],
      stats: null,
    })
    expect(result).toContain('Metformina')
    expect(result).not.toContain('Infinity')
    expect(result).not.toContain('restantes')
  })

  it('protocolo órfão (medicine inexistente) não lista medicamento', () => {
    const result = buildPatientContext({
      medicines: [],
      protocols: [{ medicine_id: 'uuid-orfao', active: true, frequency: 'diario', time_schedule: ['08:00'] }],
      logs: [],
      stockSummary: [],
      stats: null,
    })
    expect(result).toContain('Tratamentos ativos: 0')
  })

  it('stockSummary ausente → fallback p/ soma de medicine.stock', () => {
    const result = buildPatientContext({
      medicines: mockMedicines,
      protocols: mockProtocols,
      logs: [],
      stockSummary: [],
      stats: null,
    })
    expect(result).toContain('estoque 20 unidades')
  })
})

// -- Plan-grouping (onda 1b) --
describe('buildPatientContext — agrupamento por plano (onda 1b)', () => {
  const meds = [
    { id: 'm1', name: 'Atorvastatina', dosage_per_pill: 20, dosage_unit: 'mg', stock: [{ quantity: 30 }] },
    { id: 'm2', name: 'Ezetimiba', dosage_per_pill: 10, dosage_unit: 'mg', stock: [{ quantity: 30 }] },
    { id: 'm3', name: 'Metformina', dosage_per_pill: 500, dosage_unit: 'mg', stock: [{ quantity: 60 }] },
    { id: 'm4', name: 'Sinvastatina', dosage_per_pill: 40, dosage_unit: 'mg', stock: [{ quantity: 30 }] },
  ]
  const plan = (name) => ({ active: true, frequency: 'diario', time_schedule: ['08:00'], treatment_plan: name ? { name } : null })
  const stockOf = (ids) => ids.map((id) => ({ medicine: { id }, total: 30, daysRemaining: 30, dailyIntake: 1, isZero: false, isLow: false }))

  it('agrupa por plano e lista os sem-plano flat ANTES dos grupos nomeados', () => {
    const result = buildPatientContext({
      medicines: meds,
      protocols: [
        { medicine_id: 'm1', ...plan('dislipidemia') },
        { medicine_id: 'm2', ...plan('dislipidemia') },
        { medicine_id: 'm4', ...plan(null) }, // sem plano → flat
      ],
      logs: [],
      stockSummary: stockOf(['m1', 'm2', 'm4']),
      stats: null,
    })
    expect(result).toContain('Plano "dislipidemia":')
    expect(result).toContain('Atorvastatina')
    expect(result).toContain('Ezetimiba')
    expect(result).toContain('Sinvastatina')
    // sem rótulo "Sem plano"
    expect(result).not.toContain('Sem plano')
    // ordem: Sinvastatina (flat) ANTES do header do plano
    expect(result.indexOf('Sinvastatina')).toBeLessThan(result.indexOf('Plano "dislipidemia":'))
    // itens do plano DEPOIS do header
    expect(result.indexOf('Plano "dislipidemia":')).toBeLessThan(result.indexOf('Atorvastatina'))
  })

  it('plano com 1 item ainda recebe header', () => {
    const result = buildPatientContext({
      medicines: meds,
      protocols: [{ medicine_id: 'm3', ...plan('quarteto') }],
      logs: [],
      stockSummary: stockOf(['m3']),
      stats: null,
    })
    expect(result).toContain('Plano "quarteto":')
    expect(result).toContain('Metformina')
  })

  it('treatment_plan.name nulo → tratado como sem plano (flat, sem header)', () => {
    const result = buildPatientContext({
      medicines: meds,
      protocols: [{ medicine_id: 'm1', active: true, frequency: 'diario', time_schedule: ['08:00'], treatment_plan: { name: null } }],
      logs: [],
      stockSummary: stockOf(['m1']),
      stats: null,
    })
    expect(result).toContain('Atorvastatina')
    expect(result).not.toContain('Plano "')
    expect(result).not.toContain('Sem plano')
  })

  it('treatment_plan.name só-espaços → tratado como sem plano (sem header vazio)', () => {
    const result = buildPatientContext({
      medicines: meds,
      protocols: [{ medicine_id: 'm1', active: true, frequency: 'diario', time_schedule: ['08:00'], treatment_plan: { name: '   ' } }],
      logs: [],
      stockSummary: stockOf(['m1']),
      stats: null,
    })
    expect(result).toContain('Atorvastatina')
    expect(result).not.toContain('Plano "')
    expect(result).not.toContain('"   "')
  })

  it('nenhum plano nomeado → formato legado flat idêntico (sem headers)', () => {
    const result = buildPatientContext({
      medicines: meds,
      protocols: [
        { medicine_id: 'm1', ...plan(null) },
        { medicine_id: 'm4', ...plan(null) },
      ],
      logs: [],
      stockSummary: stockOf(['m1', 'm4']),
      stats: null,
    })
    expect(result).not.toContain('Plano "')
    expect(result).toContain('- Atorvastatina')
    expect(result).toContain('- Sinvastatina')
  })
})

// -- Fixes multi-superfície (líquidos, semanais, perfil, resolução de nome) --
describe('buildPatientContext — unidades líquidas / semanais / perfil', () => {
  const lantus = {
    id: 'liq-1', name: 'Lantus', active_ingredient: 'Insulina Glargina', therapeutic_class: 'Antidiabeticos',
    dosage_per_pill: 100, dosage_unit: 'ui/ml', units_per_ml: 100, stock: [{ quantity: 5.2 }],
  }
  const lantusProto = {
    medicine_id: 'liq-1', active: true, frequency: 'diario', time_schedule: ['15:00'],
    intake_unit: 'UI', dosage_per_intake: 10,
  }
  const lantusStock = [{ medicine: { id: 'liq-1' }, total: 5.2, daysRemaining: 52, dailyIntake: 0.1, isZero: false, isLow: false }]

  it('líquido: estoque em ml, dose em UI com ≈ml, consumo em ml/dia (não "un.")', () => {
    const result = buildPatientContext({
      medicines: [lantus], protocols: [lantusProto], logs: [], stockSummary: lantusStock, stats: null,
    })
    expect(result).toContain('estoque 5,2 ml')
    expect(result).toContain('dose 10 UI (≈ 0,1 ml)')
    expect(result).toContain('consumo ~0,1 ml/dia')
    expect(result).not.toContain('5,2 un.')
  })

  it('semanal: inclui o(s) dia(s) da semana agendado(s)', () => {
    const ozempic = { id: 'liq-2', name: 'Ozempic', dosage_per_pill: 1.34, dosage_unit: 'mg/ml', stock: [{ quantity: 1.5 }] }
    const result = buildPatientContext({
      medicines: [ozempic],
      protocols: [{ medicine_id: 'liq-2', active: true, frequency: 'semanal', weekdays: ['sábado'], time_schedule: ['15:00'] }],
      logs: [], stockSummary: [{ medicine: { id: 'liq-2' }, total: 1.5, daysRemaining: 14, dailyIntake: 0.1, isZero: false, isLow: false }], stats: null,
    })
    expect(result).toContain('semanal (sábado)')
  })

  it('semanal entra no contexto MESMO quando a dose não cai hoje (filtro por período, não por frequência)', () => {
    // start no passado, sem end_date → vigente; weekdays vazio não exclui da listagem
    const result = buildPatientContext({
      medicines: [{ id: 'w1', name: 'Mounjaro', dosage_per_pill: 5, dosage_unit: 'mg/ml', stock: [{ quantity: 1.5 }] }],
      protocols: [{ medicine_id: 'w1', active: true, frequency: 'semanal', weekdays: ['quinta'], start_date: '2026-01-01', time_schedule: ['22:00'] }],
      logs: [], stockSummary: [{ medicine: { id: 'w1' }, total: 1.5, daysRemaining: 21, dailyIntake: 0.07, isZero: false, isLow: false }], stats: null,
    })
    expect(result).toContain('Mounjaro')
    expect(result).toContain('Tratamentos ativos: 1')
  })

  it('doses pendentes resolvem o NOME do medicamento (não "Desconhecido")', () => {
    // Relógio fixo ao meio-dia UTC (= 09:00 SP) — mesma DATA (30/06) em UTC e America/Sao_Paulo,
    // longe da meia-noite. Evita flakiness tz-dependente: com `new Date()` real o teste passava em
    // BRT mas quebrava no runner UTC do CI (a dose caía em outro bucket de dia).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'))
    try {
      // Protocolo COM id casando a dose; medicine anexado pelo builder (medicine_id → medicines[]).
      const proto = { ...lantusProto, id: 'p-liq-1' }
      const result = buildPatientContext({
        medicines: [lantus], protocols: [proto], logs: [], stockSummary: lantusStock, stats: null,
        doseInstances: [{ id: 'di-1', protocol_id: 'p-liq-1', medicine_id: 'liq-1', scheduled_for: new Date().toISOString(), status: 'pending' }],
      })
      expect(result).toContain('Próximas doses pendentes hoje')
      expect(result).toContain('Lantus')
      expect(result).not.toContain('Desconhecido')
    } finally {
      vi.useRealTimers()
    }
  })

  it('perfil preenchido → linha "Paciente: <nome>, <idade> anos"', () => {
    const result = buildPatientContext({
      medicines: [lantus], protocols: [lantusProto], logs: [], stockSummary: lantusStock, stats: null,
      profile: { display_name: 'Maria Silva', birth_date: '1950-06-01' },
    })
    expect(result).toMatch(/Paciente: Maria Silva, \d+ anos/)
  })

  it('perfil vazio → sem linha Paciente', () => {
    const result = buildPatientContext({
      medicines: [lantus], protocols: [lantusProto], logs: [], stockSummary: lantusStock, stats: null,
      profile: { display_name: null, birth_date: null },
    })
    expect(result).not.toContain('Paciente:')
  })

  it('data inclui o dia da semana nomeado', () => {
    const result = buildPatientContext({
      medicines: [lantus], protocols: [lantusProto], logs: [], stockSummary: lantusStock, stats: null,
    })
    expect(result).toMatch(/Data: (domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado),/)
  })
})
