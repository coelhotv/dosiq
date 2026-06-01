import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  classifyDose,
  buildDoseItemsFromInstances,
  DEFAULT_TZ,
} from '../doseZones.js'

// "agora" fixo: 2026-03-05 09:30:00 BRT = 12:30:00 UTC
const BASE_MS = new Date('2026-03-05T12:30:00.000Z').getTime()
/** ISO absoluto a `offsetMin` minutos de "agora". */
const iso = (offsetMin) => new Date(BASE_MS + offsetMin * 60_000).toISOString()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(BASE_MS))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────
// 1. classifyDose (pura — instante ABSOLUTO)
// ─────────────────────────────────────────────
describe('classifyDose (core)', () => {
  const now = new Date(BASE_MS)

  it('dose registrada → done (independe do tempo)', () => {
    expect(classifyDose(iso(-300), now, 120, 60, 240, true)).toBe('done')
  })

  it('60min atrás → late', () => {
    expect(classifyDose(iso(-60), now, 120, 60, 240, false)).toBe('late')
  })

  it('180min atrás → null (fora da janela late)', () => {
    expect(classifyDose(iso(-180), now, 120, 60, 240, false)).toBeNull()
  })

  it('instante exato → now', () => {
    expect(classifyDose(iso(0), now, 120, 60, 240, false)).toBe('now')
  })

  it('+30min → now', () => {
    expect(classifyDose(iso(30), now, 120, 60, 240, false)).toBe('now')
  })

  it('+120min → upcoming', () => {
    expect(classifyDose(iso(120), now, 120, 60, 240, false)).toBe('upcoming')
  })

  it('+300min → later', () => {
    expect(classifyDose(iso(300), now, 120, 60, 240, false)).toBe('later')
  })

  it('scheduledFor inválido → null', () => {
    expect(classifyDose('lixo', now, 120, 60, 240, false)).toBeNull()
  })

  it('aceita Date além de ISO string', () => {
    expect(classifyDose(new Date(BASE_MS - 60 * 60_000), now, 120, 60, 240, false)).toBe('late')
  })

  it('cutoff de atraso usa toleranceMinutes da ocorrência, não 120 fixo', () => {
    // 100min atrasada, tolerância 90 → passou (missed → null)
    expect(classifyDose(iso(-100), now, 120, 60, 240, false, 90)).toBeNull()
    // mesma dose sem tolerância (fallback 120) → ainda 'late'
    expect(classifyDose(iso(-100), now, 120, 60, 240, false, null)).toBe('late')
  })

  it('adjacentes (gap 3h, tol 90) tilam: a de -91min sai, a de +89min fica', () => {
    expect(classifyDose(iso(-91), now, 120, 60, 240, false, 90)).toBeNull() // 12:00 → missed
    expect(classifyDose(iso(89), now, 120, 60, 240, false, 90)).not.toBeNull() // 15:00 → visível
  })
})

// ─────────────────────────────────────────────
// 2. buildDoseItemsFromInstances
// ─────────────────────────────────────────────
describe('buildDoseItemsFromInstances (core)', () => {
  const protocols = [
    {
      id: 'p1',
      medicine_id: 'm1',
      medicine: { name: 'Losartana', type: 'medicamento' },
      treatment_plan_id: null,
      treatment_plan: null,
      dosage_per_intake: 1,
    },
  ]

  it('mapeia instância → DoseItem com instanceId, scheduledFor e status', () => {
    const doses = buildDoseItemsFromInstances(
      [{ id: 'i1', protocol_id: 'p1', scheduled_for: iso(-30), status: 'pending', expected_dose: 2, tolerance_minutes: 90 }],
      protocols
    )
    expect(doses).toHaveLength(1)
    expect(doses[0]).toMatchObject({
      instanceId: 'i1',
      protocolId: 'p1',
      medicineId: 'm1',
      medicineName: 'Losartana',
      status: 'pending',
      dosagePerIntake: 2, // expected_dose tem prioridade
      toleranceMinutes: 90,
      isRegistered: false,
    })
    expect(doses[0].scheduledFor).toBe(iso(-30))
  })

  it('taken → isRegistered true + registeredAt', () => {
    const doses = buildDoseItemsFromInstances(
      [{ id: 'i1', protocol_id: 'p1', scheduled_for: iso(-60), status: 'taken' }],
      protocols
    )
    expect(doses[0].isRegistered).toBe(true)
    expect(doses[0].registeredAt).toBe(iso(-60))
  })

  it('pula skipped_* (não é pendência)', () => {
    const doses = buildDoseItemsFromInstances(
      [
        { id: 'i1', protocol_id: 'p1', scheduled_for: iso(0), status: 'skipped_paused' },
        { id: 'i2', protocol_id: 'p1', scheduled_for: iso(10), status: 'skipped_user' },
      ],
      protocols
    )
    expect(doses).toHaveLength(0)
  })

  it('pula instância sem protocolo correspondente', () => {
    const doses = buildDoseItemsFromInstances(
      [{ id: 'i1', protocol_id: 'fantasma', scheduled_for: iso(0), status: 'pending' }],
      protocols
    )
    expect(doses).toHaveLength(0)
  })

  it('lista vazia / não-array → []', () => {
    expect(buildDoseItemsFromInstances([], protocols)).toEqual([])
    expect(buildDoseItemsFromInstances(null, protocols)).toEqual([])
  })

  it('missed continua visível (actionável p/ self-heal)', () => {
    const doses = buildDoseItemsFromInstances(
      [{ id: 'i1', protocol_id: 'p1', scheduled_for: iso(-90), status: 'missed' }],
      protocols
    )
    expect(doses).toHaveLength(1)
    expect(doses[0].isRegistered).toBe(false)
  })

  it('scheduledTime deriva de scheduled_for no tz (default SP, GMT-3)', () => {
    // 12:30 UTC → 09:30 em America/Sao_Paulo
    const doses = buildDoseItemsFromInstances(
      [{ id: 'i1', protocol_id: 'p1', scheduled_for: iso(0), status: 'pending' }],
      protocols
    )
    expect(doses[0].scheduledTime).toBe('09:30')
  })

  it('tz injetável muda o HH:MM local (Londres GMT+0 em março = 12:30)', () => {
    const doses = buildDoseItemsFromInstances(
      [{ id: 'i1', protocol_id: 'p1', scheduled_for: iso(0), status: 'pending' }],
      protocols,
      'Europe/London'
    )
    expect(doses[0].scheduledTime).toBe('12:30')
  })

  it('DEFAULT_TZ exportado é São Paulo', () => {
    expect(DEFAULT_TZ).toBe('America/Sao_Paulo')
  })
})
