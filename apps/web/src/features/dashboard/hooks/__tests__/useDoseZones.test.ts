import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  classifyDose,
  buildDoseItemsFromInstances,
  useDoseZones,
} from '@/features/dashboard/hooks/useDoseZones'

// Mock do useDashboard
const mockUseDashboard = vi.fn()

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: () => mockUseDashboard(),
}))

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
describe('classifyDose', () => {
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
describe('buildDoseItemsFromInstances', () => {
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
    // 052: a ocorrência carrega `medicine_id` (NOT NULL no banco desde o PO-3).
    const doses = buildDoseItemsFromInstances(
      [{ id: 'i1', protocol_id: 'p1', medicine_id: 'm1', scheduled_for: iso(-30), status: 'pending', expected_dose: 2, tolerance_minutes: 90 }],
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
})

// ─────────────────────────────────────────────
// 3. hook behavior
// ─────────────────────────────────────────────
describe('useDoseZones — hook behavior', () => {
  const protocol = {
    id: 'p1',
    medicine_id: 'm1',
    medicine: { name: 'A', type: 'medicamento' },
    treatment_plan_id: null,
    treatment_plan: null,
    dosage_per_intake: 1,
  }

  function setupDashboard(doseInstances = [], protocols = [protocol], timezone = undefined) {
    mockUseDashboard.mockReturnValue({
      protocols,
      doseInstances,
      timezone,
      isLoading: false,
      refresh: vi.fn(),
    })
  }

  const inst = (id, offsetMin, status = 'pending', toleranceMinutes = null) => ({
    id,
    protocol_id: 'p1',
    scheduled_for: iso(offsetMin),
    status,
    expected_dose: 1,
    ...(toleranceMinutes != null ? { tolerance_minutes: toleranceMinutes } : {}),
  })

  it('zonas vazias quando não há instâncias', () => {
    setupDashboard()
    const { result } = renderHook(() => useDoseZones())
    expect(Object.values(result.current.zones).flat()).toHaveLength(0)
  })

  it('honra tolerance_minutes: dose 100min atrasada com tol 90 não aparece (missed)', () => {
    setupDashboard([inst('a', -100, 'pending', 90)])
    const { result } = renderHook(() => useDoseZones())
    expect(Object.values(result.current.zones).flat()).toHaveLength(0)
  })

  it('distribui instâncias entre zonas por instante absoluto', () => {
    setupDashboard([
      inst('a', -90), // late
      inst('b', 30), // now
      inst('c', 150), // upcoming
      inst('d', 750), // later
    ])
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.zones.late).toHaveLength(1)
    expect(result.current.zones.now).toHaveLength(1)
    expect(result.current.zones.upcoming).toHaveLength(1)
    expect(result.current.zones.later).toHaveLength(1)
  })

  it('taken → zona done', () => {
    setupDashboard([inst('a', -60, 'taken')])
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.zones.done).toHaveLength(1)
  })

  it('totals.pending = expected - taken', () => {
    setupDashboard([inst('a', 30), inst('b', -60, 'taken')])
    const { result } = renderHook(() => useDoseZones())
    const { expected, taken, pending } = result.current.totals
    expect(taken).toBe(1)
    expect(pending).toBe(expected - taken)
  })

  it('recalcula zonas quando now avança (setInterval 60s)', () => {
    setupDashboard([inst('a', 20)]) // +20min = now
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.zones.now).toHaveLength(1)

    // +70min → instância agora 50min no passado → late
    act(() => {
      vi.advanceTimersByTime(70 * 60 * 1000)
    })
    expect(result.current.zones.now).toHaveLength(0)
    expect(result.current.zones.late).toHaveLength(1)
  })

  it('ordena cada zona por instante agendado', () => {
    setupDashboard([inst('c', 760), inst('a', 740), inst('b', 750)])
    const { result } = renderHook(() => useDoseZones())
    const later = result.current.zones.later
    expect(later.map((d) => d.instanceId)).toEqual(['a', 'b', 'c'])
  })

  it('F4.3f.1: deriva HH:MM/now no tz do perfil (Londres ≠ SP)', () => {
    // BASE_MS = 2026-03-05 12:30 UTC → SP 09:30, Londres 12:30 (GMT em março).
    setupDashboard([inst('a', 30)], [protocol], 'Europe/London')
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.now.getHours()).toBe(12) // wall-clock de Londres
    expect(result.current.todayDoses[0].scheduledTime).toBe('13:00') // 12:30+30min em Londres
  })

  it('F4.3f.1: fallback SP quando timezone ausente', () => {
    setupDashboard([inst('a', 30)]) // sem timezone
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.now.getHours()).toBe(9) // 09:30 SP
  })
})

// ─────────────────────────────────────────────
// 4. carry-over "Pendências de ontem" (F4.3e)
// ─────────────────────────────────────────────
describe('useDoseZones — carry-over (F4.3e)', () => {
  const protocol = {
    id: 'p1',
    medicine_id: 'm1',
    medicine: { name: 'A', type: 'medicamento' },
    treatment_plan_id: null,
    treatment_plan: null,
    dosage_per_intake: 1,
  }
  function setupDashboard(doseInstances = []) {
    mockUseDashboard.mockReturnValue({
      protocols: [protocol],
      doseInstances,
      isLoading: false,
      refresh: vi.fn(),
    })
  }
  const row = (id, schedUtc, status = 'pending', tol = 120) => ({
    id,
    protocol_id: 'p1',
    scheduled_for: schedUtc,
    status,
    expected_dose: 1,
    tolerance_minutes: tol,
  })

  beforeEach(() => {
    // "agora" = 2026-03-05 01:00 BRT (04:00 UTC) — madrugada, p/ ontem ainda no prazo.
    vi.setSystemTime(new Date('2026-03-05T04:00:00.000Z'))
  })

  it('dose de ontem pending dentro da tolerância → carryOver (não em zones)', () => {
    // 2026-03-04 23:30 BRT = 03-05 02:30 UTC → 90min antes, late
    setupDashboard([row('y1', '2026-03-05T02:30:00.000Z')])
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.carryOver).toHaveLength(1)
    expect(result.current.carryOver[0].instanceId).toBe('y1')
    // não deve poluir as zonas de hoje
    expect(Object.values(result.current.zones).flat()).toHaveLength(0)
  })

  it('sem carry-over → carryOver vazio (dose só de hoje)', () => {
    // 2026-03-05 08:00 BRT = 11:00 UTC → hoje
    setupDashboard([row('t1', '2026-03-05T11:00:00.000Z')])
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.carryOver).toHaveLength(0)
    expect(result.current.todayDoses).toHaveLength(1)
  })

  it('dose de ontem fora da tolerância → não entra no carryOver', () => {
    // 03-05 00:00 UTC → 240min antes > tol 120 → null
    setupDashboard([row('y2', '2026-03-05T00:00:00.000Z')])
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.carryOver).toHaveLength(0)
  })

  it('lookAhead: dose de amanhã dentro da tolerância (fim do dia)', () => {
    // "agora" = 2026-03-05 23:30 BRT (03-06 02:30 UTC); dose amanhã 00:30 BRT = 03:30 UTC → 60min
    vi.setSystemTime(new Date('2026-03-06T02:30:00.000Z'))
    setupDashboard([row('a1', '2026-03-06T03:30:00.000Z')])
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.lookAhead).toHaveLength(1)
    expect(result.current.lookAhead[0].instanceId).toBe('a1')
    expect(result.current.carryOver).toHaveLength(0)
  })
})
