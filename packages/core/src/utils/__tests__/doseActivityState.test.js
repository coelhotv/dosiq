import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  deriveDoseActivityState,
  selectActiveDoseActivity,
  DOSE_ACTIVITY_STATES,
} from '../doseActivityState.js'

// "agora" fixo: 2026-03-05 09:30:00 BRT = 12:30:00 UTC
const BASE_MS = new Date('2026-03-05T12:30:00.000Z').getTime()
const now = new Date(BASE_MS)
/** ISO absoluto a `offsetMin` minutos de "agora". */
const iso = (offsetMin) => new Date(BASE_MS + offsetMin * 60_000).toISOString()

/** DoseItem mínimo (forma do buildDoseItemsFromInstances). */
const item = (over = {}) => ({
  instanceId: 'i1',
  scheduledFor: iso(0),
  status: 'pending',
  isRegistered: false,
  treatmentPlanId: null,
  toleranceMinutes: null,
  critical: false,
  medicineName: 'Lantus',
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(BASE_MS))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────
// T012 — deriveDoseActivityState (mapa zona→estado + boundaries + negative paths)
// ─────────────────────────────────────────────
describe('deriveDoseActivityState — mapa zona → estado', () => {
  it('registrada → done (independe do tempo)', () => {
    const st = deriveDoseActivityState(item({ isRegistered: true, scheduledFor: iso(-300) }), now)
    expect(st.state).toBe(DOSE_ACTIVITY_STATES.DONE)
    expect(st.isRegistered).toBe(true)
  })

  it('status taken → done mesmo sem isRegistered explícito', () => {
    const st = deriveDoseActivityState(item({ status: 'taken', isRegistered: false }), now)
    expect(st.state).toBe(DOSE_ACTIVITY_STATES.DONE)
  })

  it('60min atrás → late', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(-60) }), now).state).toBe(
      DOSE_ACTIVITY_STATES.LATE
    )
  })

  it('instante exato → now', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(0) }), now).state).toBe(
      DOSE_ACTIVITY_STATES.NOW
    )
  })

  it('+30min → now', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(30) }), now).state).toBe(
      DOSE_ACTIVITY_STATES.NOW
    )
  })

  it('+120min → upcoming', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(120) }), now).state).toBe(
      DOSE_ACTIVITY_STATES.UPCOMING
    )
  })

  it('+300min (later) colapsa em upcoming', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(300) }), now).state).toBe(
      DOSE_ACTIVITY_STATES.UPCOMING
    )
  })

  it('passou da tolerância (instante válido) → missed', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(-200) }), now).state).toBe(
      DOSE_ACTIVITY_STATES.MISSED
    )
  })
})

describe('deriveDoseActivityState — boundaries', () => {
  it('exatamente -lateCutoff (-120) ainda é late (L96 usa <)', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(-120) }), now).state).toBe(
      DOSE_ACTIVITY_STATES.LATE
    )
  })

  it('1min além do cutoff (-121) → missed', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(-121) }), now).state).toBe(
      DOSE_ACTIVITY_STATES.MISSED
    )
  })

  it('toleranceMinutes dinâmico encurta o cutoff (gap pequeno)', () => {
    // tol=30 → -45min já passou da tolerância → missed (não late)
    expect(
      deriveDoseActivityState(item({ scheduledFor: iso(-45), toleranceMinutes: 30 }), now).state
    ).toBe(DOSE_ACTIVITY_STATES.MISSED)
  })

  it('remainingSeconds negativo p/ atrasada (base do count-up)', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(-60) }), now).remainingSeconds).toBe(
      -3600
    )
  })

  it('remainingSeconds positivo p/ próxima (base do countdown)', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: iso(30) }), now).remainingSeconds).toBe(
      1800
    )
  })
})

describe('deriveDoseActivityState — negative paths (degenerados)', () => {
  it('item null → null (não lança)', () => {
    expect(deriveDoseActivityState(null, now)).toBeNull()
  })

  it('scheduledFor ausente → null (sem superfície, não missed)', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: null }), now)).toBeNull()
  })

  it('scheduledFor ISO inválido → null', () => {
    expect(deriveDoseActivityState(item({ scheduledFor: 'not-a-date' }), now)).toBeNull()
  })

  it('now inválido → cai p/ getRawNow (não lança, deriva estado)', () => {
    const st = deriveDoseActivityState(item({ scheduledFor: iso(0) }), new Date(NaN))
    expect(st).not.toBeNull()
    expect(st.state).toBe(DOSE_ACTIVITY_STATES.NOW)
  })

  it('now como ISO string é aceito (paridade splitDayTimeline)', () => {
    const st = deriveDoseActivityState(item({ scheduledFor: iso(-60) }), iso(0))
    expect(st.state).toBe(DOSE_ACTIVITY_STATES.LATE)
    expect(st.remainingSeconds).toBe(-3600)
  })

  it('isCritical undefined tratado como false', () => {
    const st = deriveDoseActivityState(item({ critical: undefined }), now)
    expect(st.isCritical).toBe(false)
  })

  it('aceita dose_instance crua (snake_case)', () => {
    const st = deriveDoseActivityState(
      {
        id: 'raw1',
        scheduled_for: iso(-60),
        status: 'pending',
        treatment_plan_id: 'plan-x',
        tolerance_minutes: null,
        critical_alarm: true,
        medicine: { name: 'Mounjaro' },
      },
      now
    )
    expect(st.instanceId).toBe('raw1')
    expect(st.treatmentId).toBe('plan-x')
    expect(st.isCritical).toBe(true)
    expect(st.medicineLabel).toBe('Mounjaro')
    expect(st.state).toBe(DOSE_ACTIVITY_STATES.LATE)
  })

  it('medicineLabel fallback "Dose" sem nome', () => {
    expect(deriveDoseActivityState(item({ medicineName: undefined }), now).medicineLabel).toBe(
      'Dose'
    )
  })
})

// ─────────────────────────────────────────────
// T013 — selectActiveDoseActivity (prioridade + agrupamento, 1 superfície)
// ─────────────────────────────────────────────
describe('selectActiveDoseActivity — empty/degenerados', () => {
  it('lista vazia → null', () => {
    expect(selectActiveDoseActivity([], now)).toBeNull()
  })

  it('não-array → null', () => {
    expect(selectActiveDoseActivity(null, now)).toBeNull()
  })

  it('só doses terminais (done/missed) → null (nenhuma actionável)', () => {
    const items = [
      item({ instanceId: 'a', isRegistered: true }),
      item({ instanceId: 'b', scheduledFor: iso(-200) }), // missed
    ]
    expect(selectActiveDoseActivity(items, now)).toBeNull()
  })
})

describe('selectActiveDoseActivity — prioridade atrasada > crítica > now > próxima', () => {
  it('atrasada vence now', () => {
    const winner = selectActiveDoseActivity(
      [item({ instanceId: 'now', scheduledFor: iso(0) }), item({ instanceId: 'late', scheduledFor: iso(-60) })],
      now
    )
    expect(winner.instanceId).toBe('late')
    expect(winner.state).toBe(DOSE_ACTIVITY_STATES.LATE)
  })

  it('crítica (now) vence now comum', () => {
    const winner = selectActiveDoseActivity(
      [
        item({ instanceId: 'comum', scheduledFor: iso(10) }),
        item({ instanceId: 'crit', scheduledFor: iso(20), critical: true }),
      ],
      now
    )
    expect(winner.instanceId).toBe('crit')
  })

  it('atrasada comum vence crítica não-atrasada (late é o sinal mais urgente)', () => {
    const winner = selectActiveDoseActivity(
      [
        item({ instanceId: 'critNow', scheduledFor: iso(10), critical: true }),
        item({ instanceId: 'late', scheduledFor: iso(-30) }),
      ],
      now
    )
    expect(winner.instanceId).toBe('late')
  })

  it('now vence próxima', () => {
    const winner = selectActiveDoseActivity(
      [item({ instanceId: 'prox', scheduledFor: iso(120) }), item({ instanceId: 'now', scheduledFor: iso(20) })],
      now
    )
    expect(winner.instanceId).toBe('now')
  })

  it('empate de prioridade → mais urgente (menor remainingSeconds)', () => {
    const winner = selectActiveDoseActivity(
      [item({ instanceId: 'menos', scheduledFor: iso(-30) }), item({ instanceId: 'mais', scheduledFor: iso(-90) })],
      now
    )
    expect(winner.instanceId).toBe('mais') // mais atrasada
  })
})

describe('selectActiveDoseActivity — agrupamento por plano (1 superfície, nunca 2)', () => {
  it('multi-dose mesmo minuto/plano → 1 superfície com groupSize', () => {
    const items = [
      item({ instanceId: 'a', scheduledFor: iso(0), treatmentPlanId: 'p1' }),
      item({ instanceId: 'b', scheduledFor: iso(0), treatmentPlanId: 'p1' }),
    ]
    const winner = selectActiveDoseActivity(items, now)
    expect(winner).not.toBeNull()
    expect(winner.groupSize).toBe(2)
    expect(winner.treatmentId).toBe('p1')
  })

  it('planos distintos → 1 vencedor, groupSize só do plano dele', () => {
    const items = [
      item({ instanceId: 'a', scheduledFor: iso(-60), treatmentPlanId: 'p1' }), // late, vence
      item({ instanceId: 'b', scheduledFor: iso(0), treatmentPlanId: 'p2' }),
      item({ instanceId: 'c', scheduledFor: iso(0), treatmentPlanId: 'p2' }),
    ]
    const winner = selectActiveDoseActivity(items, now)
    expect(winner.treatmentId).toBe('p1')
    expect(winner.groupSize).toBe(1) // só p1 é actionável-vencedor; não soma p2
  })

  it('doses avulsas (treatmentId null) não agrupam entre si → groupSize 1', () => {
    const items = [
      item({ instanceId: 'a', scheduledFor: iso(0), treatmentPlanId: null }),
      item({ instanceId: 'b', scheduledFor: iso(0), treatmentPlanId: null }),
    ]
    expect(selectActiveDoseActivity(items, now).groupSize).toBe(1)
  })

  it('dose registrada + late simultâneas → late (done não compete)', () => {
    const items = [
      item({ instanceId: 'done', isRegistered: true, treatmentPlanId: 'p1' }),
      item({ instanceId: 'late', scheduledFor: iso(-60), treatmentPlanId: 'p1' }),
    ]
    const winner = selectActiveDoseActivity(items, now)
    expect(winner.instanceId).toBe('late')
    expect(winner.groupSize).toBe(1) // done não conta no grupo actionável
  })
})
