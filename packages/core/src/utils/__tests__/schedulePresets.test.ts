// schedulePresets.test.ts — 086: presets derivados de time_schedule (nunca persistidos).
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  SCHEDULE_PRESETS,
  computePresetSchedule,
  deriveSchedulePreset,
  deriveAnchor,
  findEarlyMorningDose,
} from '../schedulePresets'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const KEY_BY_N = { 1: '1x', 2: '12h', 3: '8h', 4: '6h' } as const

describe('schedulePresets', () => {
  it('PO-1: todas as 1440 âncoras x n=1..4 geram preset válido e fazem round-trip', () => {
    let checked = 0
    for (let minute = 0; minute < 1440; minute++) {
      const anchor = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
      for (const n of [1, 2, 3, 4] as const) {
        const result = computePresetSchedule(n, anchor)
        expect(result).toHaveLength(n)
        expect(result.every((t) => TIME_REGEX.test(t))).toBe(true)
        expect(new Set(result).size).toBe(n)
        expect(result).toContain(anchor)
        expect(result).toEqual([...result].sort())
        expect(deriveSchedulePreset(result)).toBe(KEY_BY_N[n])
        checked++
      }
    }
    expect(checked).toBe(1440 * 4)
  })

  it('SCHEDULE_PRESETS mapeia chave -> nº de doses', () => {
    expect(SCHEDULE_PRESETS).toEqual({ '1x': 1, '12h': 2, '8h': 3, '6h': 4 })
  })

  describe('PO-2: padrões reais de produção', () => {
    const table: Array<[string[], string | null]> = [
      [['08:00', '20:00'], '12h'],
      [['05:30', '13:30', '21:30'], '8h'],
      [['07:15', '12:00', '17:00'], 'manual'],
      [['12:15', '23:30'], 'manual'],
      [['08:00'], '1x'],
      [[], null],
      [['07:00', '15:00', '23:00'], '8h'],
      [['00:00', '06:00', '12:00', '18:00'], '6h'],
      [['20:00', '08:00'], '12h'],
    ]
    it.each(table)('%j -> %s', (schedule, expected) => {
      expect(deriveSchedulePreset(schedule)).toBe(expected)
    })
  })

  // MUTAÇÃO DE CONTROLE: este caso existe para ficar VERMELHO se alguém introduzir tolerância
  // de 1 min (ou qualquer tolerância) na derivação. Tolerância é ZERO (spec 086).
  it('controle: 1 minuto de desvio é manual (tolerância zero)', () => {
    expect(deriveSchedulePreset(['08:00', '20:01'])).toBe('manual')
    expect(deriveSchedulePreset(['07:00', '15:00', '22:59'])).toBe('manual')
  })

  describe('degenerados', () => {
    it('entrada não-array => null', () => {
      expect(deriveSchedulePreset(null)).toBeNull()
      expect(deriveSchedulePreset(undefined)).toBeNull()
      expect(deriveSchedulePreset('08:00')).toBeNull()
    })
    it('duplicata, formato inválido, 24:00 e >4 horários => manual', () => {
      expect(deriveSchedulePreset(['08:00', '08:00'])).toBe('manual')
      expect(deriveSchedulePreset(['8:00'])).toBe('manual')
      expect(deriveSchedulePreset(['24:00'])).toBe('manual')
      expect(deriveSchedulePreset(['01:00', '05:00', '09:00', '13:00', '17:00'])).toBe('manual')
    })
    it('quando_necessário => null', () => {
      expect(deriveSchedulePreset(['08:00', '20:00'], 'quando_necessário')).toBeNull()
    })
    it('computePresetSchedule com entrada inválida => []', () => {
      expect(computePresetSchedule(5, '08:00')).toEqual([])
      expect(computePresetSchedule(0, '08:00')).toEqual([])
      expect(computePresetSchedule(2, '7:00')).toEqual([])
      expect(computePresetSchedule(2, null as unknown as string)).toEqual([])
    })
  })

  describe('âncora / edge', () => {
    it('vira o dia e ordena', () => {
      expect(computePresetSchedule(2, '23:30')).toEqual(['11:30', '23:30'])
      expect(computePresetSchedule(3, '07:15')).toEqual(['07:15', '15:15', '23:15'])
      expect(computePresetSchedule(4, '06:00')).toEqual(['00:00', '06:00', '12:00', '18:00'])
    })
  })

  describe('deriveAnchor', () => {
    it('primeira dose >= 05:00, senão a primeira', () => {
      expect(deriveAnchor(['00:00', '06:00', '12:00', '18:00'])).toBe('06:00')
      expect(deriveAnchor(['03:00'])).toBe('03:00')
      expect(deriveAnchor(['01:00', '04:00'])).toBe('01:00')
      expect(deriveAnchor(['05:00', '13:00', '21:00'])).toBe('05:00')
      expect(deriveAnchor([])).toBeNull()
    })
  })

  describe('findEarlyMorningDose', () => {
    it('primeira dose na madrugada [00:01, 06:00) — meia-noite e 06:00 ficam fora', () => {
      expect(findEarlyMorningDose(['00:00', '06:00', '12:00', '18:00'])).toBeNull()
      expect(findEarlyMorningDose(['00:01', '12:01'])).toBe('00:01')
      expect(findEarlyMorningDose(['05:30', '13:30', '21:30'])).toBe('05:30')
      expect(findEarlyMorningDose(['05:59', '17:59'])).toBe('05:59')
      expect(findEarlyMorningDose(['06:00', '14:00', '22:00'])).toBeNull()
      expect(findEarlyMorningDose([])).toBeNull()
    })

    it('todo preset sai da madrugada com primeira dose às 06:00 (texto do aviso é verdadeiro)', () => {
      for (const n of [2, 3, 4]) expect(findEarlyMorningDose(computePresetSchedule(n, '06:00'))).toBeNull()
    })
  })
})
