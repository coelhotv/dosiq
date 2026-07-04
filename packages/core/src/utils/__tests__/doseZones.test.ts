import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  classifyDose,
  buildDoseItemsFromInstances,
  splitDayTimeline,
  DEFAULT_TZ,
} from '../doseZones'

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

  it('scheduledFor null/undefined → null (guard defensivo, PR #623)', () => {
    expect(classifyDose(null, now, 120, 60, 240, false)).toBeNull()
    expect(classifyDose(undefined, now, 120, 60, 240, false)).toBeNull()
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

  it('scheduled_for inválido → scheduledTime "--:--" (fallback, PR #623)', () => {
    const doses = buildDoseItemsFromInstances(
      [{ id: 'i1', protocol_id: 'p1', scheduled_for: 'lixo', status: 'pending' }],
      protocols
    )
    expect(doses[0].scheduledTime).toBe('--:--')
  })

  it('protocols não-array ou com nulos → não estoura (guard, PR #623)', () => {
    expect(() =>
      buildDoseItemsFromInstances(
        [{ id: 'i1', protocol_id: 'p1', scheduled_for: iso(0), status: 'pending' }],
        [null, undefined, ...protocols]
      )
    ).not.toThrow()
    expect(
      buildDoseItemsFromInstances(
        [{ id: 'i1', protocol_id: 'p1', scheduled_for: iso(0), status: 'pending' }],
        { not: 'array' }
      )
    ).toEqual([])
  })

  it('DEFAULT_TZ exportado é São Paulo', () => {
    expect(DEFAULT_TZ).toBe('America/Sao_Paulo')
  })
})

// ─────────────────────────────────────────────
// 3. splitDayTimeline (F4.3e — carry-over cross-dia)
// ─────────────────────────────────────────────
describe('splitDayTimeline (core / F4.3e)', () => {
  // "agora" = 2026-03-05 01:00:00 BRT (04:00:00 UTC) — madrugada, p/ ontem ainda
  // estar dentro da tolerância (cross-meia-noite).
  const NOW = new Date('2026-03-05T04:00:00.000Z')
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
  // helper: ocorrência
  const inst = (id, schedUtc, status = 'pending', tol = 120) => ({
    id,
    protocol_id: 'p1',
    scheduled_for: schedUtc,
    status,
    tolerance_minutes: tol,
  })

  it('dose de ontem pending dentro da tolerância → carryOver', () => {
    // 2026-03-04 23:30 BRT = 2026-03-05 02:30 UTC → 90min antes de NOW, late
    const { carryOver, today } = splitDayTimeline(
      [inst('y1', '2026-03-05T02:30:00.000Z')],
      protocols,
      { now: NOW }
    )
    expect(carryOver).toHaveLength(1)
    expect(carryOver[0].instanceId).toBe('y1')
    expect(today).toHaveLength(0)
  })

  it('dose de ontem fora da tolerância (pós-tolerância) → NÃO entra', () => {
    // 2026-03-04 21:00 BRT = 2026-03-05 00:00 UTC → 240min antes, > tol 120 → null
    const { carryOver } = splitDayTimeline(
      [inst('y2', '2026-03-05T00:00:00.000Z')],
      protocols,
      { now: NOW }
    )
    expect(carryOver).toHaveLength(0)
  })

  it('dose de ontem já taken/missed → NÃO entra no carryOver', () => {
    const { carryOver } = splitDayTimeline(
      [
        inst('y3', '2026-03-05T02:30:00.000Z', 'taken'),
        inst('y4', '2026-03-05T02:30:00.000Z', 'missed'),
      ],
      protocols,
      { now: NOW }
    )
    expect(carryOver).toHaveLength(0)
  })

  it('dose de hoje → today (não carryOver)', () => {
    // 2026-03-05 08:00 BRT = 11:00 UTC → dentro do dia local de hoje
    const { carryOver, today } = splitDayTimeline(
      [inst('t1', '2026-03-05T11:00:00.000Z')],
      protocols,
      { now: NOW }
    )
    expect(today).toHaveLength(1)
    expect(today[0].instanceId).toBe('t1')
    expect(carryOver).toHaveLength(0)
  })

  it('particiona mix ontem-actionável + hoje + ontem-perdida', () => {
    const { carryOver, today } = splitDayTimeline(
      [
        inst('y1', '2026-03-05T02:30:00.000Z'), // ontem late → carry
        inst('y2', '2026-03-05T00:00:00.000Z'), // ontem pós-tolerância → fora
        inst('t1', '2026-03-05T11:00:00.000Z'), // hoje → today
      ],
      protocols,
      { now: NOW }
    )
    expect(carryOver.map((d) => d.instanceId)).toEqual(['y1'])
    expect(today.map((d) => d.instanceId)).toEqual(['t1'])
  })

  it('tz injetável move a fronteira do dia (Londres)', () => {
    // NOW 04:00 UTC = 04:00 Londres (março, GMT+0 antes do DST 30/03).
    // dose 2026-03-05 02:30 UTC = 02:30 Londres → mesmo dia local de hoje em Londres
    // (não vira carry-over como em SP, onde era 23:30 de ontem).
    const { carryOver, today } = splitDayTimeline(
      [inst('x1', '2026-03-05T02:30:00.000Z')],
      protocols,
      { now: NOW, tz: 'Europe/London' }
    )
    expect(carryOver).toHaveLength(0)
    expect(today).toHaveLength(1)
  })

  it('entrada vazia / não-array → { [], [], [] }', () => {
    expect(splitDayTimeline([], protocols, { now: NOW })).toEqual({ carryOver: [], today: [], lookAhead: [] })
    expect(splitDayTimeline(null, protocols, { now: NOW })).toEqual({ carryOver: [], today: [], lookAhead: [] })
  })

  it('now inválido → shape vazia (sem RangeError do getUserTime)', () => {
    expect(() => splitDayTimeline([], protocols, { now: 'lixo' })).not.toThrow()
    expect(splitDayTimeline([], protocols, { now: 'lixo' })).toEqual({ carryOver: [], today: [], lookAhead: [] })
  })

  it('now omitido → fallback getRawNow (sem crash)', () => {
    expect(() => splitDayTimeline([], protocols, {})).not.toThrow()
    expect(splitDayTimeline([], protocols)).toEqual({ carryOver: [], today: [], lookAhead: [] })
  })

  // ── lookAhead (espelho do carryOver — janela PARA FRENTE pela tolerância) ──
  describe('lookAhead (F4.3e bidirecional)', () => {
    // "agora" = 2026-03-05 23:30:00 BRT (2026-03-06 02:30 UTC) — fim do dia, p/ amanhã chegando.
    const NIGHT = new Date('2026-03-06T02:30:00.000Z')

    it('dose de amanhã pending dentro da tolerância → lookAhead', () => {
      // 2026-03-06 00:30 BRT = 03-06 03:30 UTC → 60min à frente, tol 120 → lookAhead
      const { lookAhead, today } = splitDayTimeline(
        [inst('a1', '2026-03-06T03:30:00.000Z')],
        protocols,
        { now: NIGHT }
      )
      expect(lookAhead).toHaveLength(1)
      expect(lookAhead[0].instanceId).toBe('a1')
      expect(today).toHaveLength(0)
    })

    it('dose de amanhã fora da tolerância (longe) → NÃO entra', () => {
      // 2026-03-06 09:00 BRT = 12:00 UTC → ~570min à frente > tol 120
      const { lookAhead } = splitDayTimeline(
        [inst('a2', '2026-03-06T12:00:00.000Z')],
        protocols,
        { now: NIGHT }
      )
      expect(lookAhead).toHaveLength(0)
    })

    it('dose de amanhã já não-pending → NÃO entra', () => {
      const { lookAhead } = splitDayTimeline(
        [inst('a3', '2026-03-06T03:30:00.000Z', 'skipped_user')],
        protocols,
        { now: NIGHT }
      )
      expect(lookAhead).toHaveLength(0)
    })

    it('simetria: mesma config rende carryOver de manhã e lookAhead de noite', () => {
      // ocorrência às 00:30 BRT (03:30 UTC):
      // - de madrugada (01:00 BRT) ela é a próxima de hoje (today, não cross-dia);
      // - usar uma de ontem 23:30 + uma de amanhã 00:30 vistas da noite:
      const { carryOver, lookAhead } = splitDayTimeline(
        [
          inst('y', '2026-03-06T02:00:00.000Z'), // 2026-03-05 23:00 BRT = hoje (dia de NIGHT) → today
          inst('a', '2026-03-06T03:30:00.000Z'), // amanhã 00:30 → lookAhead
        ],
        protocols,
        { now: NIGHT }
      )
      expect(lookAhead.map((d) => d.instanceId)).toEqual(['a'])
      expect(carryOver).toHaveLength(0)
    })
  })
})
