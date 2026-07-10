// Testes para periodKey — chave de período da notification_outbox (spec 043 Slice A)
import { describe, it, expect, vi, afterEach } from 'vitest'
import { periodKey } from '../periodKey.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('periodKey', () => {
  describe('daily', () => {
    it('retorna YYYY-MM-DD na tz local do usuário', () => {
      const date = new Date('2026-07-10T15:30:00Z')
      expect(periodKey('daily_adherence', date, 'America/Sao_Paulo')).toBe('2026-07-10')
    })

    it('mesmo instante UTC cai em dias locais diferentes conforme userTz (tz-boundary)', () => {
      // 2026-07-10T02:30:00Z é 23:30 do dia 09 em America/Sao_Paulo (UTC-3), mas
      // já é 02:30 do dia 10 em Europe/London (BST, UTC+1) — mesma instante, dias diferentes.
      const instant = new Date('2026-07-10T02:30:00Z')
      expect(periodKey('daily_digest', instant, 'America/Sao_Paulo')).toBe('2026-07-09')
      expect(periodKey('daily_digest', instant, 'Europe/London')).toBe('2026-07-10')
    })

    it('kinds daily_adherence/daily_digest/stock_alert usam granularidade diária', () => {
      const date = new Date('2026-03-15T12:00:00Z')
      expect(periodKey('daily_adherence', date, 'America/Sao_Paulo')).toBe('2026-03-15')
      expect(periodKey('daily_digest', date, 'America/Sao_Paulo')).toBe('2026-03-15')
      expect(periodKey('stock_alert', date, 'America/Sao_Paulo')).toBe('2026-03-15')
    })
  })

  describe('weekly', () => {
    it('retorna YYYY-Www ISO-8601', () => {
      // 2026-07-06 é segunda-feira da semana 28
      const date = new Date('2026-07-06T12:00:00Z')
      expect(periodKey('weekly_adherence', date, 'America/Sao_Paulo')).toBe('2026-W28')
    })

    it('kind weekly_adherence usa granularidade semanal', () => {
      const date = new Date('2026-07-08T12:00:00Z')
      expect(periodKey('weekly_adherence', date, 'America/Sao_Paulo')).toMatch(/^\d{4}-W\d{2}$/)
    })

    it('virada de ano: 2027-01-01 pode cair na semana 53 do isoYear 2026', () => {
      // 2027-01-01 é sexta-feira; a semana ISO que contém essa sexta pertence ao isoYear 2026
      // (quinta-feira âncora da semana, 2026-12-31, ainda está em 2026).
      const date = new Date('2027-01-01T12:00:00Z')
      expect(periodKey('weekly_adherence', date, 'America/Sao_Paulo')).toBe('2026-W53')
    })

    it('domingo e a segunda seguinte caem em semanas ISO diferentes', () => {
      // 2026-07-05 é domingo (fim da semana 27); 2026-07-06 é segunda (início da semana 28).
      const sunday = new Date('2026-07-05T12:00:00Z')
      const monday = new Date('2026-07-06T12:00:00Z')
      const sundayKey = periodKey('weekly_adherence', sunday, 'America/Sao_Paulo')
      const mondayKey = periodKey('weekly_adherence', monday, 'America/Sao_Paulo')
      expect(sundayKey).toBe('2026-W27')
      expect(mondayKey).toBe('2026-W28')
      expect(sundayKey).not.toBe(mondayKey)
    })
  })

  describe('monthly', () => {
    it('retorna YYYY-MM', () => {
      const date = new Date('2026-11-20T12:00:00Z')
      expect(periodKey('monthly_report', date, 'America/Sao_Paulo')).toBe('2026-11')
    })

    it('kind monthly_report usa granularidade mensal', () => {
      const date = new Date('2026-01-31T23:59:00Z')
      expect(periodKey('monthly_report', date, 'America/Sao_Paulo')).toMatch(/^\d{4}-\d{2}$/)
    })
  })

  it('determinística: mesmo (kind, date, tz) produz sempre a mesma chave', () => {
    const date = new Date('2026-05-10T10:00:00Z')
    const a = periodKey('daily_adherence', date, 'America/Sao_Paulo')
    const b = periodKey('daily_adherence', date, 'America/Sao_Paulo')
    expect(a).toBe(b)
  })
})
