import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  TIMEZONE_OPTIONS,
  TIMEZONES_BR,
  DEFAULT_TIMEZONE,
  getDeviceTimezone,
  resolveSupportedTz,
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

  it('ordena pelo relógio crescente = GMT decrescente (offset não-crescente)', () => {
    const offsets = TIMEZONE_OPTIONS.map((o) => o.offset)
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i]).toBeLessThanOrEqual(offsets[i - 1])
    }
  })

  it('dentro do mesmo offset, BR vem antes do expat e São Paulo encabeça o GMT-3', () => {
    const values = TIMEZONE_OPTIONS.map((o) => o.value)
    // GMT-5: BR (Rio Branco, Eirunepé) antes de Nova York
    expect(values.indexOf('America/Rio_Branco')).toBeLessThan(values.indexOf('America/New_York'))
    // GMT-3: São Paulo é o primeiro do bloco
    const g3 = TIMEZONE_OPTIONS.filter((o) => o.offset === -3).map((o) => o.value)
    expect(g3[0]).toBe('America/Sao_Paulo')
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

// F4.3f.0 / ADR-053 — captura de fuso do device no onboarding.
describe('resolveSupportedTz / getDeviceTimezone (F4.3f.0)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('DEFAULT_TIMEZONE é São Paulo', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Sao_Paulo')
  })

  it('mantém um fuso suportado (BR ou expat)', () => {
    expect(resolveSupportedTz('Europe/London')).toBe('Europe/London')
    expect(resolveSupportedTz('America/Manaus')).toBe('America/Manaus')
  })

  it('cai no default p/ fuso não suportado, nulo ou indefinido', () => {
    expect(resolveSupportedTz('Asia/Tokyo')).toBe('America/Sao_Paulo')
    expect(resolveSupportedTz(null)).toBe('America/Sao_Paulo')
    expect(resolveSupportedTz(undefined)).toBe('America/Sao_Paulo')
    expect(resolveSupportedTz('')).toBe('America/Sao_Paulo')
  })

  it('o resultado de resolveSupportedTz sempre passa no enum do schema', () => {
    for (const tz of ['Europe/London', 'Asia/Tokyo', null, 'America/Manaus']) {
      const resolved = resolveSupportedTz(tz)
      expect(userSettingsNotificationSchema.safeParse({ timezone: resolved }).success).toBe(true)
    }
  })

  it('getDeviceTimezone lê o fuso via Intl', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/London' }),
    })
    expect(getDeviceTimezone()).toBe('Europe/London')
  })

  it('getDeviceTimezone retorna null quando Intl lança (Hermes legado)', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl indisponível')
    })
    expect(getDeviceTimezone()).toBeNull()
  })
})
