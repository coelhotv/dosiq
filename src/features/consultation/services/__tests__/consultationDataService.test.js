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
    takenAnytime: 28,
    expected: 30,
    rates: { punctuality: 90 },
  },
  mockTitrationData: {
    currentStep: 1,
    totalSteps: 3,
    day: 5,
    totalDays: 7,
    progressPercent: 71.4,
    isTransitionDue: false,
    stageNote: 'Aumentar gradualmente',
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
  getPrescriptionStatus: vi.fn(() => ({ status: 'vigente', daysRemaining: 30 })),
  getExpiringPrescriptions: vi.fn(() => mocks.mockPrescriptions),
}))

// Mock do adherenceLogic - retorna zeros quando logs ou protocols são vazios/nulos
vi.mock('@utils/adherenceLogic', () => ({
  calculateAdherenceStats: vi.fn((logs, protocols) => {
    if (!logs || logs.length === 0 || !protocols || protocols.length === 0) {
      return {
        score: 0,
        takenAnytime: 0,
        expected: 0,
        rates: { punctuality: 0 },
      }
    }
    return mocks.mockAdherenceStats
  }),
}))

// Mock do titrationUtils
vi.mock('@utils/titrationUtils', () => ({
  calculateTitrationData: vi.fn(() => mocks.mockTitrationData),
}))

// Mock do dateUtils
vi.mock('@utils/dateUtils', () => ({
  parseLocalDate: (dateStr) => new Date(dateStr + 'T00:00:00'),
}))

import { getConsultationData } from '../consultationDataService'

describe('consultationDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockEmergencyCard = null
    mocks.mockAdherenceStats = {
      score: 85,
      takenAnytime: 28,
      expected: 30,
      rates: { punctuality: 90 },
    }
    mocks.mockTitrationData = {
      currentStep: 1,
      totalSteps: 3,
      day: 5,
      totalDays: 7,
      progressPercent: 71.4,
      isTransitionDue: false,
      stageNote: 'Aumentar gradualmente',
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
      dosagem_por_comprimido: 500,
      dosagem_unidade: 'mg',
      notes: 'Tomar após refeições',
      min_stock_threshold: 5,
    },
    {
      id: 'med-2',
      name: 'Ibuprofeno',
      type: 'comprimido',
      dosagem_por_comprimido: 400,
      dosagem_unidade: 'mg',
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
      dosage: 1,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      titration_schedule: null,
    },
    {
      id: 'prot-2',
      medicine_id: 'med-2',
      medicine_name: 'Ibuprofeno',
      active: true,
      frequency: 'semanal',
      time_schedule: ['08:00'],
      dosage: 1,
      start_date: '2026-01-15',
      end_date: '2026-06-30',
      titration_schedule: [
        { dosage: 1, days: 3 },
        { dosage: 2, days: 4 },
      ],
      current_stage_index: 0,
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
        notes: 'Tomar após refeições',
      })
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
        totalSteps: 3,
        currentDay: 5,
        totalDays: 7,
        progressPercent: 71,
        isTransitionDue: false,
        stageNote: 'Aumentar gradualmente',
        daysRemaining: 2,
        currentDosage: 1,
      })
    })

    it('deve calcular sumário de aderência para 30d e 90d', () => {
      const dashboardData = createMockDashboardData()
      const result = getConsultationData(dashboardData)

      expect(result.adherenceSummary.last30d).toMatchObject({
        score: 85,
        taken: 28,
        expected: 30,
        punctuality: 90,
      })
      expect(result.adherenceSummary.last90d).toMatchObject({
        score: 85,
        taken: 28,
        expected: 30,
        punctuality: 90,
      })
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

  describe('sem logs de aderência', () => {
    it('deve retornar zeros em adherenceSummary quando não há logs', () => {
      const dashboardData = createMockDashboardData({ logs: [] })
      const result = getConsultationData(dashboardData)

      expect(result.adherenceSummary.last30d).toEqual({
        score: 0,
        taken: 0,
        expected: 0,
        punctuality: 0,
      })
      expect(result.adherenceSummary.last90d).toEqual({
        score: 0,
        taken: 0,
        expected: 0,
        punctuality: 0,
      })
    })

    it('deve retornar zeros quando logs é null', () => {
      const dashboardData = createMockDashboardData({ logs: null })
      const result = getConsultationData(dashboardData)

      expect(result.adherenceSummary.last30d.score).toBe(0)
      expect(result.adherenceSummary.last90d.score).toBe(0)
    })

    it('deve retornar zeros quando protocols é null', () => {
      const dashboardData = createMockDashboardData({ protocols: null })
      const result = getConsultationData(dashboardData)

      expect(result.adherenceSummary.last30d.score).toBe(0)
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
})
