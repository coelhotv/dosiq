import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  TIMEZONE_OPTIONS,
  TIMEZONES_BR,
  userSettingsNotificationSchema,
} from '../userSettingsSchema.js'

// S4.4b / ADR-053 — enum de fuso curado (BR-first + expat). Armazenar SEMPRE IANA;
// DST resolvido pelo nome IANA, nunca por offset.
describe('userSettingsSchema — timezone (ADR-053)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('inclui os destinos expat curados (Caminho B)', () => {
    const values = TIMEZONE_OPTIONS.map((o) => o.value)
    expect(values).toEqual(expect.arrayContaining([
      'America/New_York',
      'America/Los_Angeles',
      'Europe/Lisbon',
      'Europe/London',
    ]))
  })

  it('mantém ordenação BR-first (São Paulo antes de qualquer expat)', () => {
    const values = TIMEZONE_OPTIONS.map((o) => o.value)
    const spIdx = values.indexOf('America/Sao_Paulo')
    const firstExpatIdx = Math.min(
      ...['America/New_York', 'Europe/London', 'Europe/Lisbon', 'America/Los_Angeles'].map((v) => values.indexOf(v))
    )
    expect(spIdx).toBeGreaterThanOrEqual(0)
    expect(spIdx).toBeLessThan(firstExpatIdx)
  })

  it('aceita fuso expat válido (brasileiro em Londres/NY persiste o IANA real)', () => {
    for (const tz of ['Europe/London', 'America/New_York', 'Europe/Lisbon', 'America/Los_Angeles']) {
      const r = userSettingsNotificationSchema.safeParse({ timezone: tz })
      expect(r.success).toBe(true)
      expect(r.data.timezone).toBe(tz)
    }
  })

  it('aceita fusos BR e usa São Paulo como default', () => {
    expect(userSettingsNotificationSchema.parse({}).timezone).toBe('America/Sao_Paulo')
    expect(userSettingsNotificationSchema.safeParse({ timezone: 'America/Manaus' }).success).toBe(true)
  })

  it('rejeita IANA fora da lista curada (Caminho C não liberado)', () => {
    expect(userSettingsNotificationSchema.safeParse({ timezone: 'Asia/Tokyo' }).success).toBe(false)
    expect(userSettingsNotificationSchema.safeParse({ timezone: 'America/Bogota' }).success).toBe(false)
    expect(userSettingsNotificationSchema.safeParse({ timezone: 'GMT-3' }).success).toBe(false)
  })

  it('TIMEZONES_BR deriva de TIMEZONE_OPTIONS (back-compat do nome)', () => {
    expect(TIMEZONES_BR).toEqual(TIMEZONE_OPTIONS.map((o) => o.value))
  })

  it('cidades BR de mesmo offset permanecem distintas (offset≠identidade)', () => {
    const values = TIMEZONE_OPTIONS.map((o) => o.value)
    // vários GMT-3 distintos
    expect(values).toEqual(expect.arrayContaining(['America/Sao_Paulo', 'America/Belem', 'America/Fortaleza', 'America/Recife']))
    expect(new Set(values).size).toBe(values.length) // sem duplicatas
  })
})
