import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  analyzeReminderTiming,
  isSuggestionDismissed,
  dismissSuggestion,
} from '../reminderOptimizerService'

describe('reminderOptimizerService', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    localStorage.clear()
  })

  describe('analyzeReminderTiming', () => {
    const mockProtocol = {
      id: 'proto-1',
      medicine_id: 'med-1',
      frequency: 'diario',
      time_schedule: ['08:00'],
    }

    const createMockLog = (hour, minute, protocolId = 'proto-1') => ({
      id: `log-${Math.random()}`,
      protocol_id: protocolId,
      medicine_id: 'med-1',
      quantity_taken: 1,
      taken_at: new Date(2026, 2, 8, hour, minute).toISOString(),
    })

    it('retorna null quando time_schedule está vazio', () => {
      const protocol = { ...mockProtocol, time_schedule: [] }
      const logs = []
      const result = analyzeReminderTiming({ protocol, logs })
      expect(result).toBeNull()
    })

    it('retorna null quando time_schedule é null', () => {
      const protocol = { ...mockProtocol, time_schedule: null }
      const logs = []
      const result = analyzeReminderTiming({ protocol, logs })
      expect(result).toBeNull()
    })

    it('retorna null quando frequency é "quando_necessario"', () => {
      const protocol = { ...mockProtocol, frequency: 'quando_necessario' }
      const logs = [createMockLog(7, 45), createMockLog(8, 15), createMockLog(8, 10)]
      const result = analyzeReminderTiming({ protocol, logs })
      expect(result).toBeNull()
    })

    it('retorna null quando logs insuficientes (<10 amostras)', () => {
      const logs = [createMockLog(8, 5), createMockLog(8, 10), createMockLog(8, 0)]
      const result = analyzeReminderTiming({ protocol: mockProtocol, logs })
      expect(result).toBeNull()
    })

    it('retorna null quando delta é <= 30 minutos', () => {
      // Protocolo: 08:00, logs: 08:15 (delta = 15 min < 30)
      const logs = Array.from({ length: 10 }, (_, i) => createMockLog(8, 15 + (i % 5)))
      const result = analyzeReminderTiming({ protocol: mockProtocol, logs })
      expect(result).toBeNull()
    })

    it('sugere ajuste quando |avgDelta| > 30 minutos (caso 1: toma mais cedo)', () => {
      // Protocolo: 08:00, logs: 07:20 (delta = -40 min, direção 'earlier')
      // -40 / 15 = -2.67 → round = -3 → -3 * 15 = -45 → 08:00 - 45 min = 07:15
      const logs = Array.from({ length: 12 }, () => createMockLog(7, 20))
      const result = analyzeReminderTiming({ protocol: mockProtocol, logs })

      expect(result).not.toBeNull()
      expect(result.shouldSuggest).toBe(true)
      expect(result.currentTime).toBe('08:00')
      expect(result.suggestedTime).toBe('07:15') // Arredondado para 15 min
      expect(result.direction).toBe('earlier')
      expect(result.avgDeltaMinutes).toBe(-40)
      expect(result.sampleCount).toBe(12)
    })

    it('sugere ajuste quando |avgDelta| > 30 minutos (caso 2: toma mais tarde)', () => {
      // Protocolo: 08:00, logs: 08:45 (delta = +45 min, direção 'later')
      const logs = Array.from({ length: 15 }, () => createMockLog(8, 45))
      const result = analyzeReminderTiming({ protocol: mockProtocol, logs })

      expect(result).not.toBeNull()
      expect(result.shouldSuggest).toBe(true)
      expect(result.currentTime).toBe('08:00')
      expect(result.suggestedTime).toBe('08:45') // Arredondado para 15 min
      expect(result.direction).toBe('later')
      expect(result.avgDeltaMinutes).toBe(45)
      expect(result.sampleCount).toBe(15)
    })

    it('arredonda sugestão para 15 minutos (delta=-37)', () => {
      // -37 min / 15 = -2.46 → round = -2 → -2 * 15 = -30
      const logs = Array.from({ length: 10 }, () => createMockLog(7, 23)) // 08:00 - 37 min
      const result = analyzeReminderTiming({ protocol: mockProtocol, logs })

      expect(result).not.toBeNull()
      expect(result.suggestedTime).toBe('07:30') // 08:00 - 30 min
    })

    it('arredonda sugestão para 15 minutos (delta=+38)', () => {
      // +38 min / 15 = 2.53 → round = 3 → 3 * 15 = 45
      const logs = Array.from({ length: 10 }, () => createMockLog(8, 38))
      const result = analyzeReminderTiming({ protocol: mockProtocol, logs })

      expect(result).not.toBeNull()
      expect(result.suggestedTime).toBe('08:45') // 08:00 + 45 min
    })

    it('filtra apenas logs dentro da janela de 4 horas', () => {
      // Protocolo: 08:00
      // Logs dentro da janela 4h: todos tomados em 08:45 (delta +45 > 30)
      // Logs fora: 13:00+ (fora da janela, descartados)
      const logs = [
        // 10 logs dentro da janela 4h, tomados em 08:45
        createMockLog(8, 45),
        createMockLog(8, 45),
        createMockLog(8, 46),
        createMockLog(8, 44),
        createMockLog(8, 45),
        createMockLog(8, 45),
        createMockLog(8, 45),
        createMockLog(8, 47),
        createMockLog(8, 45),
        createMockLog(8, 43),
        // Logs fora da janela 4h (devem ser ignorados)
        createMockLog(13, 0), // 5h depois = 300 min, fora da janela
        createMockLog(3, 0), // 5h antes = -300 min, fora da janela
      ]

      const result = analyzeReminderTiming({ protocol: mockProtocol, logs })
      expect(result).not.toBeNull()
      // Média deve estar ~45 (logs em 08:45 vs programado 08:00)
      expect(Math.abs(result.avgDeltaMinutes)).toBeGreaterThan(40)
      expect(Math.abs(result.avgDeltaMinutes)).toBeLessThan(50)
    })

    it('retorna primeira sugestão quando multiple time_schedule', () => {
      // Protocolo com 2 horários: 08:00 e 14:00
      const protocol = {
        ...mockProtocol,
        time_schedule: ['08:00', '14:00'],
      }

      // Logs para 08:00: delta = +50 min (sugere 08:45)
      const logs1 = Array.from({ length: 10 }, () => createMockLog(8, 50))

      // Logs para 14:00: delta = +60 min (sugere 15:00)
      const logs2 = Array.from({ length: 10 }, () => createMockLog(15, 0))

      const allLogs = [...logs1, ...logs2]
      const result = analyzeReminderTiming({ protocol, logs: allLogs })

      // Retorna primeira sugestão
      expect(result).not.toBeNull()
      expect(result.shouldSuggest).toBe(true)
    })

    it('valida entrada com Zod safeParse', () => {
      // Entrada inválida (protocol.id faltando)
      const invalidProtocol = {
        medicine_id: 'med-1',
        frequency: 'diario',
        time_schedule: ['08:00'],
      }

      const result = analyzeReminderTiming({
        protocol: invalidProtocol,
        logs: [],
      })

      // Zod vai rejeitar, função retorna null
      expect(result).toBeNull()
    })

    it('lida com logs sem protocol_id (filtra por medicine_id)', () => {
      // Logs com protocol_id = null, apenas medicine_id deve ser usado para match
      // Protocolo: 08:00, logs: 07:20 (delta -40)
      const logs = Array.from({ length: 12 }, () => ({
        id: `log-${Math.random()}`,
        protocol_id: null, // Sem protocol_id, filtra por medicine_id
        medicine_id: 'med-1',
        quantity_taken: 1,
        taken_at: new Date(2026, 2, 8, 7, 20).toISOString(),
      }))

      const result = analyzeReminderTiming({ protocol: mockProtocol, logs })

      expect(result).not.toBeNull()
      expect(result.direction).toBe('earlier')
      expect(Math.abs(result.avgDeltaMinutes)).toBeGreaterThan(30)
    })

    it('trata JSON parsing error em timestamp', () => {
      // Este teste verifica robustez contra dados malformados
      const logs = [
        {
          id: 'log-1',
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          quantity_taken: 1,
          taken_at: 'invalid-date',
        },
      ]

      // Deve não lançar erro, apenas retornar null
      expect(() => {
        analyzeReminderTiming({ protocol: mockProtocol, logs })
      }).not.toThrow()
    })
  })

  describe('isSuggestionDismissed', () => {
    beforeEach(() => {
      localStorage.clear()
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('retorna false quando nada foi dispensado', () => {
      const result = isSuggestionDismissed('proto-1')
      expect(result).toBe(false)
    })

    it('retorna true quando dispensado permanentemente', () => {
      dismissSuggestion('proto-1', true)
      const result = isSuggestionDismissed('proto-1')
      expect(result).toBe(true)
    })

    it('retorna true quando dentro da janela de 30 dias', () => {
      vi.setSystemTime(new Date('2026-03-08'))
      dismissSuggestion('proto-1', false)

      vi.setSystemTime(new Date('2026-03-15')) // +7 dias
      const result = isSuggestionDismissed('proto-1')
      expect(result).toBe(true)
    })

    it('retorna false quando expirou a janela de 30 dias', () => {
      vi.setSystemTime(new Date('2026-03-08'))
      dismissSuggestion('proto-1', false)

      vi.setSystemTime(new Date('2026-04-10')) // +33 dias
      const result = isSuggestionDismissed('proto-1')
      expect(result).toBe(false)
    })

    it('retorna true em ambiente server-side (typeof window === "undefined")', () => {
      // Verificamos se o código cuida disso
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      try {
        const result = isSuggestionDismissed('proto-1')
        expect(result).toBe(true)
      } finally {
        global.window = originalWindow
      }
    })

    it('trata JSON inválido em localStorage', () => {
      localStorage.setItem('optimizer_dismissed_proto-1', 'invalid json')
      const result = isSuggestionDismissed('proto-1')
      expect(result).toBe(true) // Falha segura
    })
  })

  describe('dismissSuggestion', () => {
    afterEach(() => {
      localStorage.clear()
    })

    it('armazena dispensação em localStorage (impermanente)', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-08'))

      dismissSuggestion('proto-1', false)

      const stored = localStorage.getItem('optimizer_dismissed_proto-1')
      expect(stored).not.toBeNull()

      const parsed = JSON.parse(stored)
      expect(parsed.timestamp).toBe(Date.now())
      expect(parsed.permanent).toBe(false)

      vi.useRealTimers()
    })

    it('armazena dispensação em localStorage (permanente)', () => {
      dismissSuggestion('proto-2', true)

      const stored = localStorage.getItem('optimizer_dismissed_proto-2')
      expect(stored).not.toBeNull()

      const parsed = JSON.parse(stored)
      expect(parsed.permanent).toBe(true)
    })

    it('sobrescreve dispensação anterior', () => {
      vi.useFakeTimers()

      vi.setSystemTime(new Date('2026-03-08'))
      dismissSuggestion('proto-1', false)
      const stored1 = localStorage.getItem('optimizer_dismissed_proto-1')

      vi.setSystemTime(new Date('2026-03-10'))
      dismissSuggestion('proto-1', true)
      const stored2 = localStorage.getItem('optimizer_dismissed_proto-1')

      expect(stored1).not.toBe(stored2)
      expect(JSON.parse(stored2).permanent).toBe(true)

      vi.useRealTimers()
    })

    it('não lança erro em ambiente server-side', () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      try {
        expect(() => {
          dismissSuggestion('proto-1', false)
        }).not.toThrow()
      } finally {
        global.window = originalWindow
      }
    })
  })
})
