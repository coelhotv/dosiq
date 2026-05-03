import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  classifyDose,
  isDoseRegistered,
  expandProtocolsToDoses,
  filterTodayLogs,
  useDoseZones,
} from '@/features/dashboard/hooks/useDoseZones'

// Mock do useDashboard
const mockUseDashboard = vi.fn()

vi.mock('@dashboard/hooks/useDashboardContext.jsx', () => ({
  useDashboard: () => mockUseDashboard(),
}))

// Mock de dateUtils para fixar a data
vi.mock('@utils/dateUtils', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getTodayLocal: vi.fn(() => '2026-03-05'),
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  // Fixar "agora" como 2026-03-05 09:30:00 BRT (12:30:00 UTC)
  const fakeNow = new Date('2026-03-05T09:30:00-03:00')
  vi.setSystemTime(fakeNow)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────
// 1. classifyDose (pura — sem mocks)
// ─────────────────────────────────────────────
describe('classifyDose', () => {
  // "agora" fixo: 09:30 LOCAL (São Paulo)
  const now = new Date('2026-03-05T09:30:00-03:00')

  it('classifica dose registrada como done', () => {
    expect(classifyDose('09:00', now, 120, 60, 240, true)).toBe('done')
  })

  it('classifica dose 1h atrás como late', () => {
    // 08:30 = 60 min atrás de 09:30 local
    expect(classifyDose('08:30', now, 120, 60, 240, false)).toBe('late')
  })

  it('classifica dose 3h atrás como null (fora da janela)', () => {
    // 06:30 = 180 min atrás → > lateWindow(120)
    expect(classifyDose('06:30', now, 120, 60, 240, false)).toBeNull()
  })

  it('classifica dose no horário atual como now', () => {
    // 09:30 = now exato → diffMin = 0 → now
    expect(classifyDose('09:30', now, 120, 60, 240, false)).toBe('now')
  })

  it('classifica dose em 30min como now', () => {
    // 10:00 = 30 min no futuro → < nowWindow(60)
    expect(classifyDose('10:00', now, 120, 60, 240, false)).toBe('now')
  })

  it('classifica dose em 2h como upcoming', () => {
    // 11:30 = 120 min → >= nowWindow(60) e < upcomingWindow(240)
    expect(classifyDose('11:30', now, 120, 60, 240, false)).toBe('upcoming')
  })

  it('classifica dose em 5h como later', () => {
    // 14:30 = 300 min → > upcomingWindow(240)
    expect(classifyDose('14:30', now, 120, 60, 240, false)).toBe('later')
  })
})

// ─────────────────────────────────────────────
// 2. isDoseRegistered
// ─────────────────────────────────────────────
describe('isDoseRegistered', () => {
  // Criar taken_at em 08:05 LOCAL (São Paulo)
  const takenAt0805 = new Date('2026-03-05T08:05:00-03:00')
  const todayLogs = [{ protocol_id: 'p1', taken_at: takenAt0805.toISOString() }]

  it('retorna true quando log existe dentro da tolerância de 30min', () => {
    // dose às 08:00 → log às 08:05 local → diferença = 5min → dentro do limite
    expect(isDoseRegistered('p1', '08:00', todayLogs)).toBe(true)
  })

  it('retorna false quando protocolo não bate', () => {
    expect(isDoseRegistered('p2', '08:00', todayLogs)).toBe(false)
  })

  it('retorna false para array vazio', () => {
    expect(isDoseRegistered('p1', '08:00', [])).toBe(false)
  })
})

// ─────────────────────────────────────────────
// 3. expandProtocolsToDoses
// ─────────────────────────────────────────────
describe('expandProtocolsToDoses', () => {
  const protocols = [
    {
      id: 'p1',
      medicine_id: 'm1',
      medicine: { name: 'Losartana' },
      frequency: 'diário',
      time_schedule: ['08:00', '22:00'],
      dosage_per_intake: 1,
      treatment_plan_id: null,
      treatment_plan: null,
    },
    {
      id: 'p2',
      medicine_id: 'm2',
      medicine: { name: 'Vitamina D' },
      frequency: 'quando_necessario', // deve ser excluído
      time_schedule: ['08:00'],
      dosage_per_intake: 1,
      treatment_plan_id: null,
      treatment_plan: null,
    },
  ]

  it('expande time_schedule em doses individuais', () => {
    const doses = expandProtocolsToDoses(protocols, [])
    // p1 tem 2 horários, p2 é quando_necessario (skip)
    expect(doses).toHaveLength(2)
    expect(doses[0].scheduledTime).toBe('08:00')
    expect(doses[1].scheduledTime).toBe('22:00')
  })

  it('exclui protocolos quando_necessario', () => {
    const doses = expandProtocolsToDoses(protocols, [])
    expect(doses.every((d) => d.medicineName !== 'Vitamina D')).toBe(true)
  })

  it('popula campos do DoseItem corretamente', () => {
    const doses = expandProtocolsToDoses(protocols, [])
    expect(doses[0]).toMatchObject({
      protocolId: 'p1',
      medicineId: 'm1',
      medicineName: 'Losartana',
      dosagePerIntake: 1,
      isRegistered: false,
    })
  })
})

// ─────────────────────────────────────────────
// 4. filterTodayLogs
// ─────────────────────────────────────────────
describe('filterTodayLogs', () => {
  it('retorna apenas logs de hoje (2026-03-05 BRT)', () => {
    const logs = [
      { taken_at: '2026-03-05T11:00:00.000Z' }, // 08:00 BRT = hoje
      { taken_at: '2026-03-04T11:00:00.000Z' }, // ontem BRT
      // '2026-03-06T02:00:00.000Z' = 23:00 BRT do dia 05 = ainda hoje em BRT
      // Para ser amanhã BRT (UTC-3), precisa ser >= 2026-03-06T03:00:00Z
      { taken_at: '2026-03-06T04:00:00.000Z' }, // 01:00 BRT 06/03 = amanhã BRT
    ]
    const today = filterTodayLogs(logs)
    expect(today).toHaveLength(1)
    expect(today[0].taken_at).toBe('2026-03-05T11:00:00.000Z')
  })

  it('retorna array vazio para logs vazio', () => {
    expect(filterTodayLogs([])).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────
// 5. hook behavior
// ─────────────────────────────────────────────
describe('useDoseZones — hook behavior', () => {
  // Removido beforeEach duplicado, movido para o topo

  function setupDashboard(protocols = [], logs = []) {
    mockUseDashboard.mockReturnValue({
      protocols,
      logs,
      isLoading: false,
      refresh: vi.fn(),
    })
  }

  it('retorna zonas vazias quando não há protocolos', () => {
    setupDashboard()
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.zones.late).toHaveLength(0)
    expect(result.current.zones.now).toHaveLength(0)
    expect(result.current.zones.upcoming).toHaveLength(0)
    expect(result.current.zones.later).toHaveLength(0)
    expect(result.current.zones.done).toHaveLength(0)
  })

  it('distribui doses corretamente entre zonas', () => {
    // 09:30 BRT = now
    // - 08:00 → late (90min atrás)
    // - 10:00 → now (30min futuro)
    // - 12:00 → upcoming (150min)
    // - 22:00 → later (750min)
    setupDashboard([
      {
        id: 'p1',
        medicine_id: 'm1',
        medicine: { name: 'A' },
        frequency: 'diário',
        time_schedule: ['08:00', '10:00', '12:00', '22:00'],
        dosage_per_intake: 1,
        treatment_plan_id: null,
        treatment_plan: null,
      },
    ])
    const { result } = renderHook(() => useDoseZones())
    expect(result.current.zones.late).toHaveLength(1)
    expect(result.current.zones.late[0].scheduledTime).toBe('08:00')
    expect(result.current.zones.now).toHaveLength(1)
    expect(result.current.zones.upcoming).toHaveLength(1)
    expect(result.current.zones.later).toHaveLength(1)
  })

  it('exclui protocolos quando_necessario', () => {
    setupDashboard([
      {
        id: 'p1',
        medicine_id: 'm1',
        medicine: { name: 'A' },
        frequency: 'quando_necessario',
        time_schedule: ['08:00'],
        dosage_per_intake: 1,
        treatment_plan_id: null,
        treatment_plan: null,
      },
    ])
    const { result } = renderHook(() => useDoseZones())
    const allZones = Object.values(result.current.zones).flat()
    expect(allZones).toHaveLength(0)
  })

  it('totals.pending = expected - taken', () => {
    setupDashboard([
      {
        id: 'p1',
        medicine_id: 'm1',
        medicine: { name: 'A' },
        frequency: 'diário',
        time_schedule: ['10:00'],
        dosage_per_intake: 1,
        treatment_plan_id: null,
        treatment_plan: null,
      },
    ])
    const { result } = renderHook(() => useDoseZones())
    const { expected, taken, pending } = result.current.totals
    expect(pending).toBe(expected - taken)
  })

  it('recalcula zonas quando now muda (setInterval 60s)', () => {
    setupDashboard([
      {
        id: 'p1',
        medicine_id: 'm1',
        medicine: { name: 'A' },
        frequency: 'diário',
        time_schedule: ['09:50'], // 20min no futuro = 'now'
        dosage_per_intake: 1,
        treatment_plan_id: null,
        treatment_plan: null,
      },
    ])
    const { result } = renderHook(() => useDoseZones())

    // Inicialmente: 09:50 está a 20min → 'now'
    expect(result.current.zones.now).toHaveLength(1)

    // Avançar 70 minutos → agora é 10:40 BRT → 09:50 está 50min atrás → 'late'
    act(() => {
      vi.advanceTimersByTime(70 * 60 * 1000)
    })

    expect(result.current.zones.now).toHaveLength(0)
    expect(result.current.zones.late).toHaveLength(1)
  })

  it('ordena doses dentro de cada zona por scheduledTime', () => {
    setupDashboard([
      {
        id: 'p1',
        medicine_id: 'm1',
        medicine: { name: 'A' },
        frequency: 'diário',
        time_schedule: ['22:00', '21:00', '20:00'],
        dosage_per_intake: 1,
        treatment_plan_id: null,
        treatment_plan: null,
      },
    ])
    const { result } = renderHook(() => useDoseZones())
    const later = result.current.zones.later
    expect(later[0].scheduledTime).toBe('20:00')
    expect(later[1].scheduledTime).toBe('21:00')
    expect(later[2].scheduledTime).toBe('22:00')
  })
})
