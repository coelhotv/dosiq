// 062 D-3 (RC3 E-1): a migração de canais roda SÓ no fim do syncAlarms, depois de cancelAll +
// re-agendamento — é o único ponto em que nenhum trigger da versão antiga sobrou no canal legado.

import { syncAlarms } from '../useAlarmScheduler'
import { alarmService } from '../alarmService'

const mockCalls: string[] = []

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

jest.mock('../alarmService', () => ({
  alarmService: {
    cancelAll: jest.fn(async () => { mockCalls.push('cancelAll') }),
    scheduleAlarm: jest.fn(async () => { mockCalls.push('schedule') }),
    migrateLegacyAlarmChannels: jest.fn(async () => { mockCalls.push('migrate') }),
  },
}))

let mockItems = []
jest.mock('@dosiq/core', () => ({
  createDoseInstanceRepository: () => ({ getWindow: jest.fn().mockResolvedValue([]) }),
  createCriticalAuditService: () => ({ emit: jest.fn().mockResolvedValue({ ok: true }) }),
  buildDoseItemsFromInstances: () => mockItems,
  ensureInstancesUpTo: jest.fn().mockResolvedValue(undefined),
  getRawNow: () => new Date('2026-03-05T12:00:00.000Z'),
  addDays: (d, n) => new Date(d.getTime() + n * 86400000),
  parseISO: (s) => new Date(s),
}))

const item = (instanceId, scheduledFor) => ({
  instanceId,
  scheduledFor,
  status: 'pending',
  critical: true,
  toleranceMinutes: 120,
  medicineName: 'Lantus',
})

afterEach(() => {
  jest.clearAllMocks()
  mockCalls.length = 0
})

describe('syncAlarms — migração de canais legados', () => {
  it('ordem: cancelAll → re-agendamento → migração', async () => {
    mockItems = [item('a', '2026-03-05T13:00:00.000Z'), item('b', '2026-03-05T14:00:00.000Z')]
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(mockCalls).toEqual(['cancelAll', 'schedule', 'schedule', 'migrate'])
  })

  it('migra mesmo sem nenhuma dose crítica a agendar (C-1)', async () => {
    mockItems = []
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(mockCalls).toEqual(['cancelAll', 'migrate'])
  })

  it('migração que lança não propaga (fail-open)', async () => {
    mockItems = []
    jest.mocked(alarmService.migrateLegacyAlarmChannels).mockRejectedValueOnce(new Error('x'))
    await expect(syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })).resolves.toBeUndefined()
  })

  it('sem usuário: nada roda', async () => {
    await syncAlarms({ userId: null, protocols: [], tz: 'America/Sao_Paulo' })
    expect(mockCalls).toEqual([])
  })
})
