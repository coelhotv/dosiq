/**
 * Testes do DoseCalendar Service
 *
 * Cobre os cenários:
 * 1. Sem protocolos — retorna mapa vazio
 * 2. Protocolo diário único — contagens corretas
 * 3. Múltiplos protocolos — agrega corretamente
 * 4. Dias alternados — cálculo correto de dias
 * 5. Quando necessário — expected=0
 * 6. Protocolo com end_date no meio do mês
 * 7. Protocolo com start_date no meio do mês
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { calculateMonthlyDoseMap, calculateMonthlyStats } from '../doseCalendarService'
import { parseLocalDate } from '@utils/dateUtils'

describe('doseCalendarService', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('calculateMonthlyDoseMap', () => {
    /**
     * Cenário 1: Sem protocolos — retorna mapa com todos os dias vazios
     */
    it('retorna mapa com todos os dias sem_doses quando não há protocolos', () => {
      const logs = []
      const protocols = []
      const year = 2026
      const month = 2 // Fevereiro

      const result = calculateMonthlyDoseMap(logs, protocols, year, month)

      // Fevereiro 2026 tem 28 dias
      expect(Object.keys(result)).toHaveLength(28)

      // Todos os dias devem ter expected=0, taken=0, status='sem_doses'
      Object.values(result).forEach((dayInfo) => {
        expect(dayInfo.expected).toBe(0)
        expect(dayInfo.taken).toBe(0)
        expect(dayInfo.status).toBe('sem_doses')
      })
    })

    /**
     * Cenário 2: Protocolo diário único — contagens corretas de esperado/tomado
     */
    it('calcula corretamente doses esperadas e tomadas para protocolo diário', () => {
      const protocolId = 'proto-1'
      const protocols = [
        {
          id: protocolId,
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00', '20:00'], // 2 doses por dia
        },
      ]

      // Logs: tomou 2 doses no dia 1, 1 dose no dia 2, nenhuma no dia 3
      const logs = [
        { protocol_id: protocolId, taken_at: '2026-02-01T08:15:00' }, // dentro da tolerância de 08:00
        { protocol_id: protocolId, taken_at: '2026-02-01T20:30:00' }, // dentro da tolerância de 20:00
        { protocol_id: protocolId, taken_at: '2026-02-02T08:00:00' }, // apenas 1 dose no dia 2
      ]

      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Dia 1: 2 esperadas, 2 tomadas = completo
      expect(result['2026-02-01']).toEqual({
        expected: 2,
        taken: 2,
        status: 'completo',
      })

      // Dia 2: 2 esperadas, 1 tomada = parcial
      expect(result['2026-02-02']).toEqual({
        expected: 2,
        taken: 1,
        status: 'parcial',
      })

      // Dia 3: 2 esperadas, 0 tomadas = perdido
      expect(result['2026-02-03']).toEqual({
        expected: 2,
        taken: 0,
        status: 'perdido',
      })
    })

    /**
     * Cenário 3: Múltiplos protocolos — agrega corretamente
     */
    it('agrega corretamente múltiplos protocolos no mesmo dia', () => {
      const protocols = [
        {
          id: 'proto-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00'], // 1 dose por dia
        },
        {
          id: 'proto-2',
          active: true,
          frequency: 'diário',
          time_schedule: ['12:00', '18:00'], // 2 doses por dia
        },
      ]

      // Total esperado por dia: 3 doses (1 + 2)
      const logs = [
        { protocol_id: 'proto-1', taken_at: '2026-02-01T08:00:00' },
        { protocol_id: 'proto-2', taken_at: '2026-02-01T12:00:00' },
        // proto-2 18:00 não tomou
      ]

      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Dia 1: 3 esperadas, 2 tomadas = parcial
      expect(result['2026-02-01']).toEqual({
        expected: 3,
        taken: 2,
        status: 'parcial',
      })
    })

    /**
     * Cenário 4: Dias alternados — cálculo correto de quais dias têm dose
     */
    it('calcula corretamente dias alternados baseado na data de início', () => {
      const protocols = [
        {
          id: 'proto-alt',
          active: true,
          frequency: 'dias_alternados',
          start_date: '2026-02-01', // Dia 1 = dia par (diff=0) = tem dose
          time_schedule: ['08:00'],
        },
      ]

      const logs = []

      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Dia 1 (diff=0, par): esperado=1
      expect(result['2026-02-01'].expected).toBe(1)

      // Dia 2 (diff=1, ímpar): esperado=0
      expect(result['2026-02-02'].expected).toBe(0)

      // Dia 3 (diff=2, par): esperado=1
      expect(result['2026-02-03'].expected).toBe(1)

      // Dia 4 (diff=3, ímpar): esperado=0
      expect(result['2026-02-04'].expected).toBe(0)

      // Dia 5 (diff=4, par): esperado=1
      expect(result['2026-02-05'].expected).toBe(1)
    })

    /**
     * Cenário 5: Quando necessário — expected=0 (não gera doses esperadas)
     */
    it('retorna expected=0 para protocolo quando_necessário', () => {
      const protocols = [
        {
          id: 'proto-prn',
          active: true,
          frequency: 'quando_necessário',
          time_schedule: ['08:00'],
        },
      ]

      const logs = [
        // Mesmo com logs, expected deve ser 0
        { protocol_id: 'proto-prn', taken_at: '2026-02-01T08:00:00' },
      ]

      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Todos os dias devem ter expected=0
      Object.values(result).forEach((dayInfo) => {
        expect(dayInfo.expected).toBe(0)
        expect(dayInfo.status).toBe('sem_doses')
      })
    })

    /**
     * Cenário 6: Protocolo com end_date no meio do mês — para de contar após
     */
    it('para de contar doses após end_date do protocolo', () => {
      const protocols = [
        {
          id: 'proto-ended',
          active: true,
          frequency: 'diário',
          start_date: '2026-02-01',
          end_date: '2026-02-10', // Termina no dia 10
          time_schedule: ['08:00'],
        },
      ]

      const logs = []

      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Dia 10: ainda tem dose (end_date é inclusivo)
      expect(result['2026-02-10'].expected).toBe(1)

      // Dia 11: não tem mais dose
      expect(result['2026-02-11'].expected).toBe(0)
      expect(result['2026-02-11'].status).toBe('sem_doses')

      // Dia 12 em diante: sem doses
      expect(result['2026-02-12'].expected).toBe(0)
    })

    /**
     * Cenário 7: Protocolo com start_date no meio do mês — começa a contar a partir de
     */
    it('começa a contar doses a partir de start_date do protocolo', () => {
      const protocols = [
        {
          id: 'proto-started',
          active: true,
          frequency: 'diário',
          start_date: '2026-02-15', // Começa no dia 15
          time_schedule: ['08:00'],
        },
      ]

      const logs = []

      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Dia 14: ainda não começou
      expect(result['2026-02-14'].expected).toBe(0)
      expect(result['2026-02-14'].status).toBe('sem_doses')

      // Dia 15: primeira dose
      expect(result['2026-02-15'].expected).toBe(1)
      expect(result['2026-02-15'].status).toBe('perdido') // sem logs

      // Dia 16: continua
      expect(result['2026-02-16'].expected).toBe(1)
    })

    /**
     * Teste adicional: Protocolo inativo não gera doses
     */
    it('não conta doses para protocolo inativo', () => {
      const protocols = [
        {
          id: 'proto-inactive',
          active: false,
          frequency: 'diário',
          time_schedule: ['08:00'],
        },
      ]

      const logs = []

      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Todos os dias devem ter expected=0
      Object.values(result).forEach((dayInfo) => {
        expect(dayInfo.expected).toBe(0)
      })
    })

    /**
     * Teste adicional: Logs de outros protocolos não afetam o cálculo
     */
    it('ignora logs de outros protocolos', () => {
      const protocols = [
        {
          id: 'proto-1',
          active: true,
          frequency: 'diário',
          time_schedule: ['08:00'],
        },
      ]

      const logs = [
        // Log de outro protocolo
        { protocol_id: 'proto-outro', taken_at: '2026-02-01T08:00:00' },
      ]

      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Dia 1: 1 esperada, 0 tomadas (log é de outro protocolo)
      expect(result['2026-02-01']).toEqual({
        expected: 1,
        taken: 0,
        status: 'perdido',
      })
    })

    /**
     * Teste adicional: Frequência semanal com dias específicos
     */
    it('respeita dias específicos para frequência semanal', () => {
      const protocols = [
        {
          id: 'proto-weekly',
          active: true,
          frequency: 'semanal',
          days: ['segunda', 'quarta', 'sexta'],
          time_schedule: ['08:00'],
        },
      ]

      const logs = []
      const result = calculateMonthlyDoseMap(logs, protocols, 2026, 2)

      // Fevereiro 2026:
      // 1 = Domingo, 2 = Segunda, 3 = Terça, 4 = Quarta, 5 = Quinta, 6 = Sexta, 7 = Sábado

      // Dia 2 (Segunda): esperado=1
      expect(result['2026-02-02'].expected).toBe(1)

      // Dia 3 (Terça): esperado=0
      expect(result['2026-02-03'].expected).toBe(0)

      // Dia 4 (Quarta): esperado=1
      expect(result['2026-02-04'].expected).toBe(1)

      // Dia 5 (Quinta): esperado=0
      expect(result['2026-02-05'].expected).toBe(0)

      // Dia 6 (Sexta): esperado=1
      expect(result['2026-02-06'].expected).toBe(1)

      // Dia 7 (Sábado): esperado=0
      expect(result['2026-02-07'].expected).toBe(0)
    })
  })

  describe('calculateMonthlyStats', () => {
    /**
     * Estatísticas com mapa vazio
     */
    it('retorna zeros para mapa vazio', () => {
      const doseMap = {}

      const stats = calculateMonthlyStats(doseMap)

      expect(stats).toEqual({
        totalExpected: 0,
        totalTaken: 0,
        completeDays: 0,
        partialDays: 0,
        missedDays: 0,
        adherenceRate: 0,
      })
    })

    /**
     * Estatísticas com dias mistos
     */
    it('calcula corretamente estatísticas com dias mistos', () => {
      const doseMap = {
        '2026-02-01': { expected: 2, taken: 2, status: 'completo' },
        '2026-02-02': { expected: 2, taken: 1, status: 'parcial' },
        '2026-02-03': { expected: 2, taken: 0, status: 'perdido' },
        '2026-02-04': { expected: 0, taken: 0, status: 'sem_doses' },
      }

      const stats = calculateMonthlyStats(doseMap)

      expect(stats.totalExpected).toBe(6) // 2+2+2+0
      expect(stats.totalTaken).toBe(3) // 2+1+0+0
      expect(stats.completeDays).toBe(1)
      expect(stats.partialDays).toBe(1)
      expect(stats.missedDays).toBe(1)
      expect(stats.adherenceRate).toBe(50) // 3/6 = 50%
    })

    /**
     * Taxa de adesão com arredondamento correto
     */
    it('arredonda corretamente a taxa de adesão', () => {
      const doseMap = {
        '2026-02-01': { expected: 3, taken: 2, status: 'parcial' },
      }

      const stats = calculateMonthlyStats(doseMap)

      // 2/3 = 0.666... = 67% (arredondado)
      expect(stats.adherenceRate).toBe(67)
    })

    /**
     * Taxa de adesão 100% quando todas as doses tomadas
     */
    it('retorna 100% de adesão quando todas as doses tomadas', () => {
      const doseMap = {
        '2026-02-01': { expected: 2, taken: 2, status: 'completo' },
        '2026-02-02': { expected: 2, taken: 2, status: 'completo' },
      }

      const stats = calculateMonthlyStats(doseMap)

      expect(stats.adherenceRate).toBe(100)
      expect(stats.completeDays).toBe(2)
    })
  })
})
