/**
 * Testes do Consultation Data Service
 *
 * Testa a agregação de dados clínicos para o Modo Consulta Médica.
 *
 * @module consultationDataService.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock da data atual para testes determinísticos
const MOCK_TODAY = '2026-02-26'

// Hoist dos mocks
const mocks = vi.hoisted(() => ({
  mockEmergencyCard: null,
  mockAdherenceStats: {
    score: 85,
    taken: 27,
    takenAnytime: 28,
    expected: 30,
    rates: { punctuality: 90 },
    currentStreak: 6,
  },
  mockTitrationData: {
    currentStep: 1,
    totalSteps: 3,
    day: 5,
    totalDays: 7,
    progressPercent: 71.4,
    isTransitionDue: false,
    daysRemaining: 2,
  },
  mockPrescriptions: [],
}))

// Mock do emergencyCardService
vi.mock('@emergency/services/emergencyCardService', () => ({
  emergencyCardService: {
    getOfflineCard: vi.fn(() => mocks.mockEmergencyCard),
  },
}))

// Mock do prescriptionService
vi.mock('@prescriptions/services/prescriptionService', () => ({
  getExpiringPrescriptions: vi.fn(() => mocks.mockPrescriptions),
}))

// Mock do adherenceLogic — adesão agora vem de summaries instance-based injetados
// pelo caller (não mais calculateAdherenceStats, aposentado na Fase 4/ADR-054).
vi.mock('@utils/adherenceLogic', () => ({
  calculateDailyIntake: vi.fn((medicineId, protocols) => {
    if (!protocols) return 0
    return protocols
      .filter((p) => p.medicine_id === medicineId && p.active !== false)
      .reduce((total, p) => {
        const dosesPerDay = p.time_schedule?.length || 1
        const dosage = p.dosage_per_intake || 1
        return total + dosesPerDay * dosage
      }, 0)
  }),
}))

// Mock do titrationUtils
vi.mock('@utils/titrationUtils', () => ({
  calculateTitrationData: vi.fn(() => mocks.mockTitrationData),
}))

// Mock do dateUtils
vi.mock('@utils/dateUtils', () => ({
  parseLocalDate: (dateStr) => new Date(dateStr + 'T00:00:00'),
  getNow: () => new Date('2026-02-26T12:00:00'),
  getServerTimestamp: () => '2026-02-26T12:00:00.000Z',
  parseISO: (str) => new Date(str),
  addDays: (date, days) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
  },
}))

import { getConsultationData } from '@/features/consultation/services/consultationDataService'
import { getExpiringPrescriptions } from '@prescriptions/services/prescriptionService'
import { frequencyDailyFactor, PRESCRIPTION_EXPIRY_WARNING_DAYS } from '@dosiq/core'
import {
  CLINICAL_MEDICINES,
  CLINICAL_PROTOCOLS,
  MEDICINE_SOLID,
  MEDICINE_LIQUID,
  MEDICINE_EXPIRED,
  PROTOCOL_SOLID_MORNING,
  PROTOCOL_SOLID_EXTRA,
  PROTOCOL_LIQUID_WEEKLY,
  dateOffset,
} from '@/test/fixtures/clinicalSurfaces'

describe('consultationDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockEmergencyCard = null
    mocks.mockAdherenceStats = {
      score: 85,
      taken: 27,
      takenAnytime: 28,
      expected: 30,
      rates: { punctuality: 90 },
      currentStreak: 6,
    }
    mocks.mockTitrationData = {
      currentStep: 1,
      totalSteps: 3,
      day: 5,
      totalDays: 7,
      progressPercent: 71.4,
      isTransitionDue: false,
      daysRemaining: 2,
    }
    mocks.mockPrescriptions = []
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Dados de teste base
  const createMockMedicines = () => [
    {
      id: 'med-1',
      name: 'Paracetamol',
      type: 'comprimido',
      dosage_per_pill: 500,
      dosage_unit: 'mg',
      notes: 'Tomar após refeições',
      min_stock_threshold: 5,
    },
    {
      id: 'med-2',
      name: 'Ibuprofeno',
      type: 'comprimido',
      dosage_per_pill: 400,
      dosage_unit: 'mg',
      notes: null,
      min_stock_threshold: 3,
    },
  ]

  const createMockProtocols = () => [
    {
      id: 'prot-1',
      medicine_id: 'med-1',
      medicine_name: 'Paracetamol',
      active: true,
      frequency: 'diário',
      time_schedule: ['08:00', '20:00'],
      dosage_per_intake: 1,
      // 073: vigência agora é predicado do core com relógio REAL — datas relativas
      // evitam a bomba-relógio de um fixture ancorado em 2026.
      start_date: dateOffset(-60),
      end_date: dateOffset(120),
      // Sem escada: nenhum `titration_steps` no embed.
    },
    {
      id: 'prot-2',
      medicine_id: 'med-2',
      medicine_name: 'Ibuprofeno',
      active: true,
      frequency: 'semanal',
      time_schedule: ['08:00'],
      dosage_per_intake: 1,
      start_date: dateOffset(-45),
      end_date: dateOffset(90),
      // 029 F3.1 (T017d): a escada vem do embed `titration_steps(...)`, não do jsonb N1.
      titration_steps: [
        { position: 0, dose: 1, duration_days: 3, status: 'current', started_at: '2026-02-21T00:00:00' },
        { position: 1, dose: 2, duration_days: 4, status: 'upcoming', started_at: null },
      ],
    },
  ]

  const createMockLogs = () => [
    {
      id: 'log-1',
      protocol_id: 'prot-1',
      medicine_id: 'med-1',
      taken_at: new Date(MOCK_TODAY + 'T08:05:00').toISOString(),
      quantity_taken: 1,
      scheduled_time: '08:00',
    },
    {
      id: 'log-2',
      protocol_id: 'prot-1',
      medicine_id: 'med-1',
      taken_at: new Date(MOCK_TODAY + 'T20:10:00').toISOString(),
      quantity_taken: 1,
      scheduled_time: '20:00',
    },
  ]

  const createMockStockSummary = () => [
    {
      medicine: { id: 'med-1', name: 'Paracetamol' },
      total: 2,
      dailyIntake: 2,
      daysRemaining: 1,
      isZero: false,
      isLow: true,
    },
    {
      medicine: { id: 'med-2', name: 'Ibuprofeno' },
      total: 0,
      dailyIntake: 1,
      daysRemaining: 0,
      isZero: true,
      isLow: false,
    },
  ]

  const createMockDashboardData = (overrides = {}) => ({
    medicines: createMockMedicines(),
    protocols: createMockProtocols(),
    logs: createMockLogs(),
    stockSummary: createMockStockSummary(),
    stats: { adherenceScore: 85 },
    ...overrides,
  })

  describe('agregação completa', () => {
    it('deve retornar todas as propriedades esperadas', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData, 'João Silva', 45)

      // Verificar estrutura do objeto retornado
      expect(result).toHaveProperty('patientInfo')
      expect(result).toHaveProperty('activeMedicines')
      expect(result).toHaveProperty('adherenceSummary')
      expect(result).toHaveProperty('stockAlerts')
      expect(result).toHaveProperty('prescriptionStatus')
      expect(result).toHaveProperty('activeTitrations')
      expect(result).toHaveProperty('generatedAt')
    })

    it('deve retornar informações do paciente corretamente', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData, 'Maria Souza', 32)

      expect(result.patientInfo.name).toBe('Maria Souza')
      expect(result.patientInfo.age).toBe(32)
    })

    it('deve usar o handle do email quando o nome nao existe', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData, '', 32, 'joao.silva@email.com')

      expect(result.patientInfo.name).toBe('Joao Silva')
      expect(result.patientInfo.handle).toBe('joao.silva')
    })

    it('deve extrair medicamentos ativos corretamente', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.activeMedicines).toHaveLength(2)
      expect(result.activeMedicines[0]).toMatchObject({
        id: 'med-1',
        name: 'Paracetamol',
        type: 'comprimido',
        dosagePerPill: 500,
        dosageUnit: 'mg',
        dosagePerIntake: 500, // 500mg × 1 comprimido
        timesPerDay: 2, // 2 horários
        dailyDosage: 1000, // 500mg × 2 vezes
        notes: 'Tomar após refeições',
      })
    })

    it('deve calcular dosagem diária corretamente para múltiplos protocolos', () => {
      // Protocolos adicionais para o mesmo medicamento
      const extraProtocol = {
        id: 'prot-3',
        medicine_id: 'med-1',
        medicine_name: 'Paracetamol',
        active: true,
        frequency: 'diário',
        time_schedule: ['14:00'], // +1 horário
        dosage_per_intake: 2, // 2 comprimidos
        start_date: dateOffset(-60),
        end_date: dateOffset(120),
      }

      const dashboardData = createMockDashboardData({
        protocols: [...createMockProtocols(), extraProtocol],
      })
      const result = getConsultationData(dashboardData)

      const paracetamol = result.activeMedicines.find((m) => m.id === 'med-1')
      expect(paracetamol).toMatchObject({
        dosagePerIntake: 1500, // 500mg × (1 + 2) = 1500
        timesPerDay: 3, // 2 + 1 = 3 horários
        // 073/F-13: soma POR PROTOCOLO — (500×2) + (1.000×1) = 2.000. O valor antigo
        // (4.500) era o produto cruzado Σ(dose) × Σ(tomadas), que inflava a posologia.
        dailyDosage: 2000,
      })
    })

    it('deve retornar nulls para dosagens quando medicine não tem dosage_per_pill', () => {
      const medicinesWithoutDosage = [
        {
          id: 'med-3',
          name: 'Vitamina D',
          type: 'comprimido',
          // Sem dosage_per_pill - não podemos calcular dosagem em mg
          dosage_unit: 'UI',
        },
      ]

      const protocolsWithDosage = [
        {
          id: 'prot-3',
          medicine_id: 'med-3',
          medicine_name: 'Vitamina D',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00'],
          dosage_per_intake: 2, // 2 comprimidos por tomada
          start_date: '2026-01-01',
          end_date: '2026-12-31',
        },
      ]

      const dashboardData = createMockDashboardData({
        medicines: medicinesWithoutDosage,
        protocols: protocolsWithDosage,
      })
      const result = getConsultationData(dashboardData)

      expect(result.activeMedicines).toHaveLength(1)
      // Sem dosage_per_pill, não conseguimos calcular dosagens em mg
      // mas ainda retornamos timesPerDay
      expect(result.activeMedicines[0]).toMatchObject({
        dosagePerPill: null,
        dosagePerIntake: null,
        timesPerDay: 1,
        dailyDosage: null,
      })
    })

    it('deve retornar nulls para dosagem quando não há dados suficientes', () => {
      const medicinesNoData = [
        {
          id: 'med-4',
          name: 'Placebo',
          type: 'comprimido',
          // Sem dosage_per_pill
        },
      ]

      const protocolsNoData = [
        {
          id: 'prot-4',
          medicine_id: 'med-4',
          medicine_name: 'Placebo',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00'],
          // Sem dosage_per_intake (vai usar default 1)
          start_date: '2026-01-01',
          end_date: '2026-12-31',
        },
      ]

      const dashboardData = createMockDashboardData({
        medicines: medicinesNoData,
        protocols: protocolsNoData,
      })
      const result = getConsultationData(dashboardData)

      // Sem dosage_per_pill, não conseguimos calcular
      expect(result.activeMedicines[0]).toMatchObject({
        dosagePerPill: null,
        dosagePerIntake: null,
        timesPerDay: 1,
        dailyDosage: null,
      })
    })

    it('mantém a titulação em MANUTENÇÃO na consulta (073 F-24)', () => {
      // `calculateTitrationData` devolve null quando a etapa vigente é CONTÍNUA (dose alvo,
      // sem duração). O extrator descartava esse tratamento — e a seção de titulação SUMIA
      // exatamente para quem terminou de titular.
      mocks.mockTitrationData = null

      const dashboardData = createMockDashboardData({
        protocols: [
          {
            id: 'prot-maint',
            medicine_id: 'med-2',
            medicine_name: 'Ibuprofeno',
            active: true,
            frequency: 'semanal',
            time_schedule: ['08:00'],
            dosage_per_intake: 1,
            start_date: '2026-01-15',
            end_date: '2026-12-31',
            titration_steps: [
              // Degrau em 'cp' no MEIO da escada: prova o AC-39 sem tirar o caso líquido.
              { position: 0, dose: 2, intake_unit: 'cp', duration_days: 28, status: 'completed', started_at: '2026-01-15T00:00:00' },
              { position: 1, dose: 0.5, intake_unit: 'mg', duration_days: 28, status: 'completed', started_at: '2026-02-12T00:00:00' },
              // Etapa vigente CONTÍNUA (sem duração) = manutenção.
              { position: 2, dose: 1, intake_unit: 'mg', duration_days: null, status: 'current', started_at: '2026-03-11T00:00:00' },
            ],
          },
        ],
      })

      const result = getConsultationData(dashboardData)

      expect(result.activeTitrations).toHaveLength(1)
      expect(result.activeTitrations[0]).toMatchObject({
        protocolId: 'prot-maint',
        isMaintenance: true,
        currentStep: 3,
        totalSteps: 3,
        progressPercent: null,
        isTransitionDue: false,
        currentDosage: 1,
      })
      expect(result.activeTitrations[0].maintenanceSince).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)

      // AC-37: escada completa (dose, duração, período e situação de cada degrau).
      // AC-39: `intake_unit = 'cp'` sai por extenso — e não vira `un.` nem vaza p/ protocols.
      expect(result.activeTitrations[0].ladder).toHaveLength(3)
      expect(result.activeTitrations[0].ladder[0]).toMatchObject({
        position: 1,
        durationLabel: '28 dias',
        statusLabel: 'concluído',
        isCurrent: false,
      })
      expect(result.activeTitrations[0].ladder[0].doseLabel).toMatch(/^2 comprimidos/)
      expect(result.activeTitrations[0].ladder[0].doseLabel).not.toContain('un.')
      expect(result.activeTitrations[0].ladder[0].periodLabel).toMatch(
        /^\d{2}\/\d{2}\/\d{4} - \d{2}\/\d{2}\/\d{4}$/
      )
      expect(result.activeTitrations[0].ladder[2]).toMatchObject({
        durationLabel: 'contínua',
        statusLabel: 'atual',
        isCurrent: true,
      })
    })

    it('escada cross-medicamento: a nota da dose alvo usa a concentração do PRÓPRIO degrau (R-299)', () => {
      // Achado do RC6 do PR #809: `currentDoseLabel` recalculava a massa com o medicamento do
      // TRATAMENTO. Num medicine_switch, a nota "Dose alvo" sairia da concentração do
      // medicamento errado — e discordaria da tabela da escada no MESMO documento.
      mocks.mockTitrationData = null

      const dashboardData = createMockDashboardData({
        medicines: [
          { id: 'med-antigo', name: 'Selozok 25', dosage_per_pill: 25, dosage_unit: 'mg' },
          { id: 'med-novo', name: 'Selozok 100', dosage_per_pill: 100, dosage_unit: 'mg' },
        ],
        protocols: [
          {
            id: 'p-switch',
            medicine_id: 'med-antigo', // o tratamento ainda aponta o cadastro ANTIGO
            active: true,
            start_date: '2026-01-01',
            end_date: '2026-12-31',
            titration_steps: [
              { position: 0, dose: 1, intake_unit: 'cp', duration_days: 7, status: 'completed', started_at: '2026-01-01T00:00:00', medicine_id: 'med-antigo' },
              { position: 1, dose: 1, intake_unit: 'cp', duration_days: null, status: 'current', started_at: '2026-02-01T00:00:00', medicine_id: 'med-novo' },
            ],
          },
        ],
      })

      const [titration] = getConsultationData(dashboardData).activeTitrations

      // 1 comprimido do cadastro NOVO = 100 mg — não os 25 mg do cadastro do tratamento.
      expect(titration.currentDoseLabel).toContain('100 mg')
      expect(titration.currentDoseLabel).not.toContain('25 mg')
      // A nota e a linha da escada não podem divergir: são o mesmo rótulo.
      expect(titration.currentDoseLabel).toBe(titration.ladder[1].doseLabel)
      // Degrau de outro medicamento se identifica.
      expect(titration.ladder[1].doseLabel).toContain('Selozok 100')
    })

    it('não inventa titulação: sem escada e sem etapa vigente, a secao fica vazia (073 F-24)', () => {
      mocks.mockTitrationData = null

      const semEscada = createMockDashboardData({
        protocols: [
          { id: 'p-vazio', medicine_id: 'med-2', active: true, start_date: '2026-01-01', end_date: '2026-12-31' },
        ],
      })
      expect(getConsultationData(semEscada).activeTitrations).toHaveLength(0)

      const escadaSemVigente = createMockDashboardData({
        protocols: [
          {
            id: 'p-sem-current', medicine_id: 'med-2', active: true,
            start_date: '2026-01-01', end_date: '2026-12-31',
            titration_steps: [
              { position: 0, dose: 1, duration_days: 7, status: 'completed', started_at: '2026-01-01T00:00:00' },
              { position: 1, dose: 2, duration_days: 7, status: 'upcoming', started_at: null },
            ],
          },
        ],
      })
      expect(getConsultationData(escadaSemVigente).activeTitrations).toHaveLength(0)
    })

    it('deve extrair alertas de estoque corretamente', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.stockAlerts).toHaveLength(2)
      // Críticos primeiro
      expect(result.stockAlerts[0].severity).toBe('critical')
      expect(result.stockAlerts[0].medicineName).toBe('Ibuprofeno')
      expect(result.stockAlerts[1].severity).toBe('warning')
      expect(result.stockAlerts[1].medicineName).toBe('Paracetamol')
    })

    it('deve extrair titulações ativas corretamente', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.activeTitrations).toHaveLength(1)
      expect(result.activeTitrations[0]).toMatchObject({
        protocolId: 'prot-2',
        medicineId: 'med-2',
        medicineName: 'Ibuprofeno',
        currentStep: 1,
        // 073: `totalSteps` passa a ser o tamanho REAL da escada recebida (2 etapas no
        // fixture), não o número que o mock de `calculateTitrationData` devolve — é o mesmo
        // valor na prática e é o único que existe na linha de MANUTENÇÃO, onde o cálculo de
        // progresso devolve null por contrato.
        totalSteps: 2,
        currentDay: 5,
        totalDays: 7,
        progressPercent: 71,
        isTransitionDue: false,
        // SEMPRE null: a nota por etapa era campo do N1 e não migrou (Decisões §2) —
        // `titration_steps` não tem `description`. Decisão de produto, não omissão.
        stageNote: null,
        daysRemaining: 2,
        currentDosage: 1,
      })
    })

    it('deve mapear summaries instance-based para 30d e 90d (ADR-054)', () => {
      const dashboardData = createMockDashboardData()
      const summaries = {
        last30d: { overallScore: 85, overallTaken: 27, overallExpected: 30, currentStreak: 6 },
        last90d: { overallScore: 82, overallTaken: 80, overallExpected: 98, currentStreak: 6 },
      }
      const result = getConsultationData(dashboardData, '', null, '', null, summaries)

      expect(result.adherenceSummary.last30d).toMatchObject({
        score: 85,
        taken: 27,
        expected: 30,
        punctuality: 85, // pontualidade ≡ adesão no modelo de ocorrências
        currentStreak: 6,
      })
      expect(result.adherenceSummary.last90d).toMatchObject({
        score: 82,
        taken: 80,
        expected: 98,
        punctuality: 82,
        currentStreak: 6,
      })
      expect(result.adherenceSummary.currentStreak).toBe(6)
    })

    it('deve incluir timestamp de geração', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.generatedAt).toBeDefined()
      expect(typeof result.generatedAt).toBe('string')
      // Verificar formato ISO
      expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt)
    })
  })

  describe('dados parciais (sem emergency card)', () => {
    it('deve funcionar sem erro quando não há emergency card', () => {
      mocks.mockEmergencyCard = null
      const dashboardData = createMockDashboardData()

      expect(() => getConsultationData(dashboardData)).not.toThrow()
    })

    it('deve retornar patientInfo.emergencyCard como null', () => {
      mocks.mockEmergencyCard = null
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.patientInfo.emergencyCard).toBeNull()
    })

    it('deve incluir emergency card quando disponível', () => {
      const mockCard = {
        allergies: ['Penicilina'],
        blood_type: 'O+',
        emergency_contact: { name: 'Esposa', phone: '11999999999' },
      }
      mocks.mockEmergencyCard = mockCard
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.patientInfo.emergencyCard).toEqual(mockCard)
    })
  })

  describe('sem protocolos ativos', () => {
    it('deve retornar activeMedicines vazio quando não há protocolos', () => {
      const dashboardData = createMockDashboardData({ protocols: [] })
      const result = getConsultationData(dashboardData)

      expect(result.activeMedicines).toEqual([])
    })

    it('deve retornar activeTitrations vazio quando não há protocolos', () => {
      const dashboardData = createMockDashboardData({ protocols: [] })
      const result = getConsultationData(dashboardData)

      expect(result.activeTitrations).toEqual([])
    })

    it('deve retornar activeMedicines vazio quando todos os protocolos estão inativos', () => {
      const inactiveProtocols = createMockProtocols().map((p) => ({ ...p, active: false }))
      const dashboardData = createMockDashboardData({ protocols: inactiveProtocols })
      const result = getConsultationData(dashboardData)

      expect(result.activeMedicines).toEqual([])
    })

    it('deve incluir medicamentos de protocolos sem propriedade active (undefined = ativo)', () => {
      const protocolsWithUndefined = createMockProtocols().map((p) => ({
        ...p,
        active: undefined,
      }))
      const dashboardData = createMockDashboardData({ protocols: protocolsWithUndefined })
      const result = getConsultationData(dashboardData)

      expect(result.activeMedicines).toHaveLength(2)
    })
  })

  describe('sem summaries de aderência', () => {
    it('deve retornar zeros em adherenceSummary quando summaries não é fornecido', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.adherenceSummary.last30d).toEqual({
        score: 0,
        taken: 0,
        expected: 0,
        punctuality: 0,
        currentStreak: 0,
      })
      expect(result.adherenceSummary.last90d).toEqual({
        score: 0,
        taken: 0,
        expected: 0,
        punctuality: 0,
        currentStreak: 0,
      })
    })

    it('deve retornar zeros quando summaries é null explícito', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData, '', null, '', null, null)

      expect(result.adherenceSummary.last30d.score).toBe(0)
      expect(result.adherenceSummary.last90d.score).toBe(0)
    })

    it('tolera summary parcial (apenas last30d)', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData, '', null, '', null, {
        last30d: { overallScore: 50, overallTaken: 5, overallExpected: 10, currentStreak: 2 },
      })

      expect(result.adherenceSummary.last30d.score).toBe(50)
      expect(result.adherenceSummary.last90d.score).toBe(0)
    })
  })

  describe('sem dados de estoque', () => {
    it('deve retornar stockAlerts vazio quando stockSummary é null', () => {
      const dashboardData = createMockDashboardData({ stockSummary: null })
      const result = getConsultationData(dashboardData)

      expect(result.stockAlerts).toEqual([])
    })

    it('deve retornar stockAlerts vazio quando stockSummary é vazio', () => {
      const dashboardData = createMockDashboardData({ stockSummary: [] })
      const result = getConsultationData(dashboardData)

      expect(result.stockAlerts).toEqual([])
    })

    it('deve retornar stockAlerts vazio quando não há itens críticos ou baixos', () => {
      const normalStock = [
        {
          medicine: { id: 'med-1', name: 'Paracetamol' },
          total: 50,
          isZero: false,
          isLow: false,
        },
      ]
      const dashboardData = createMockDashboardData({ stockSummary: normalStock })
      const result = getConsultationData(dashboardData)

      expect(result.stockAlerts).toEqual([])
    })
  })

  describe('prescrições', () => {
    it('deve retornar prescriptionStatus vazio quando não há prescrições vencendo', () => {
      mocks.mockPrescriptions = []
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.prescriptionStatus).toEqual([])
    })

    it('deve incluir prescrições vencendo/vencidas quando disponíveis', () => {
      mocks.mockPrescriptions = [
        {
          protocol: {
            id: 'prot-1',
            medicine: { name: 'Paracetamol' },
            end_date: '2026-03-15',
          },
          status: 'vencendo',
          daysRemaining: 15,
        },
      ]
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.prescriptionStatus).toHaveLength(1)
      expect(result.prescriptionStatus[0]).toMatchObject({
        protocolId: 'prot-1',
        medicineName: 'Paracetamol',
        status: 'vencendo',
        daysRemaining: 15,
        isExpiring: true,
        isExpired: false,
      })
    })
  })
  // ==========================================================================
  // 073 PR 2 (Slice E) — "a conta": posologia, vigência, cadência e unidade
  // ==========================================================================
  describe('073 — a conta do modo consulta', () => {
    const clinicalDashboard = () => ({
      medicines: [...CLINICAL_MEDICINES],
      protocols: [...CLINICAL_PROTOCOLS],
      logs: [],
      stockSummary: [],
      stats: {},
    })

    it('AC-20/AC-21: 2 tratamentos vigentes do mesmo medicamento somam POR PROTOCOLO (1.500 mg, não 3.000)', () => {
      const result = getConsultationData(clinicalDashboard())
      const paracetamol = result.activeMedicines.find((m) => m.id === MEDICINE_SOLID.id)

      // (500 × 2 tomadas) + (500 × 1 tomada) = 1.500 mg/dia.
      // O produto cruzado antigo dava Σ(1.000) × Σ(3) = 3.000 mg — o DOBRO.
      expect(paracetamol.dailyDosage).toBe(1500)
      expect(paracetamol.timesPerDay).toBe(3)
    })

    it('AC-22 (não-omissão): medicamento com 1 tratamento mantém o número de hoje', () => {
      const result = getConsultationData({
        ...clinicalDashboard(),
        protocols: [PROTOCOL_SOLID_MORNING],
      })
      const paracetamol = result.activeMedicines.find((m) => m.id === MEDICINE_SOLID.id)

      expect(paracetamol.dailyDosage).toBe(1000) // 500 × 2 — inalterado
      expect(paracetamol.cadenceLabel).toBe('2x ao dia')
    })

    it('AC-23: cadência semanal não vira "x ao dia" e aplica o fator do core', () => {
      const result = getConsultationData(clinicalDashboard())
      const ozempic = result.activeMedicines.find((m) => m.id === MEDICINE_LIQUID.id)

      expect(ozempic.cadenceLabel).toBe('1x — Semanal')
      // 0,9 mL 1×/semana = 0,9/7 por dia (frequencyDailyFactor), não 0,9/dia.
      expect(ozempic.dailyDosage).toBeCloseTo(0.9 / 7, 6)
      expect(ozempic.intakeUnit).toBe('ml')
    })

    it('AC-23 (guard): o dailyDosage bate com o consumo diário que o core calcula', () => {
      const result = getConsultationData(clinicalDashboard())
      const ozempic = result.activeMedicines.find((m) => m.id === MEDICINE_LIQUID.id)

      expect(ozempic.dailyDosage).toBeCloseTo(
        PROTOCOL_LIQUID_WEEKLY.dosage_per_intake *
          PROTOCOL_LIQUID_WEEKLY.time_schedule.length *
          frequencyDailyFactor(PROTOCOL_LIQUID_WEEKLY),
        6
      )
    })

    it('AC-24: tratamento com end_date no passado NÃO é "medicamento em uso"', () => {
      const result = getConsultationData(clinicalDashboard())

      expect(result.activeMedicines.map((m) => m.id)).not.toContain(MEDICINE_EXPIRED.id)
      expect(result.activeMedicines).toHaveLength(2)
    })

    it('AC-24: tratamento com start_date no futuro também fica fora', () => {
      const future = { ...PROTOCOL_SOLID_MORNING, id: 'prot-future', start_date: dateOffset(5), end_date: dateOffset(60) }
      const result = getConsultationData({
        ...clinicalDashboard(),
        protocols: [future],
      })

      expect(result.activeMedicines).toEqual([])
    })

    it('AC-24/AC-9: a janela de prescrição é a canônica do core (14 dias), aplicada dentro do serviço', () => {
      getConsultationData(clinicalDashboard())

      // ADR-095: `thresholdDays` foi deletado — a janela não é mais argumento,
      // é a constante do core lida por getExpiringPrescriptions.
      expect(getExpiringPrescriptions).toHaveBeenCalledWith(expect.anything())
      expect(PRESCRIPTION_EXPIRY_WARNING_DAYS).toBe(14)
    })

    it('AC-25: alerta de estoque de líquido sai em mL, não "unidades"', () => {
      const result = getConsultationData({
        ...clinicalDashboard(),
        stockSummary: [
          { medicine: { id: MEDICINE_LIQUID.id, name: MEDICINE_LIQUID.name }, total: 1.5, isLow: true, isZero: false, daysRemaining: 3, dailyIntake: 0.13 },
        ],
      })

      expect(result.stockAlerts[0].message).toContain('mL')
      expect(result.stockAlerts[0].message).not.toContain('unidades')
      expect(result.stockAlerts[0].unitLabel).toBe('mL')
    })

    it('AC-25: sólido mantém a contagem em unidades e o medicamento ausente não inventa mL', () => {
      const result = getConsultationData({
        ...clinicalDashboard(),
        stockSummary: [
          { medicine: { id: MEDICINE_SOLID.id, name: MEDICINE_SOLID.name }, total: 4, isLow: true, isZero: false, daysRemaining: 2, dailyIntake: 3 },
          { medicine: { id: 'nao-cadastrado', name: 'Fantasma' }, total: 2, isLow: true, isZero: false, daysRemaining: 1, dailyIntake: 2 },
        ],
      })

      expect(result.stockAlerts.find((a) => a.medicineId === MEDICINE_SOLID.id).unitLabel).toBe('un.')
      expect(result.stockAlerts.find((a) => a.medicineId === 'nao-cadastrado').unitLabel).toBe('un.')
    })

    it('degenerado: sem dosage_per_pill não inventa dose diária', () => {
      const result = getConsultationData({
        ...clinicalDashboard(),
        medicines: [{ ...MEDICINE_SOLID, dosage_per_pill: null }],
        protocols: [PROTOCOL_SOLID_MORNING, PROTOCOL_SOLID_EXTRA],
      })

      expect(result.activeMedicines[0]).toMatchObject({
        dosagePerIntake: null,
        dailyDosage: null,
        timesPerDay: 3,
      })
    })

    it('degenerado: cadências divergentes no mesmo medicamento não viram um rótulo só', () => {
      const weeklySolid = { ...PROTOCOL_SOLID_EXTRA, frequency: 'semanal' }
      const result = getConsultationData({
        ...clinicalDashboard(),
        medicines: [MEDICINE_SOLID],
        protocols: [PROTOCOL_SOLID_MORNING, weeklySolid],
      })

      expect(result.activeMedicines[0].cadenceLabel).toBeNull()
      // 500×2 (diário) + 500×1×(1/7) (semanal)
      expect(result.activeMedicines[0].dailyDosage).toBeCloseTo(1000 + 500 / 7, 6)
    })
  })
})

