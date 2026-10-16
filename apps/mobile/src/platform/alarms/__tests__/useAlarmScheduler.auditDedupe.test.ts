// 082 D1 (E-7): o dedupe do `alarm_scheduled` só pode marcar como emitido o que o servidor ACEITOU.
// Antes, um insert falho entrava no AsyncStorage e a prova nunca era reemitida ⇒ dose "capaz + sem
// prova" ⇒ push crítico (USAGE_ALARM, 062 F3-B) sobre alarme armado ⇒ preempção do INSISTENT.

import { syncAlarms } from '../useAlarmScheduler'

const SCHEDULED_AUDIT_KEY = '@dosiq/audit/alarm_scheduled_ids'

const mockStore = new Map<string, string>()
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => mockStore.get(k) ?? null),
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v)
  }),
  removeItem: jest.fn(async (k) => {
    mockStore.delete(k)
  }),
}))

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: {} }))

jest.mock('../alarmService', () => ({
  alarmService: {
    cancelAll: jest.fn().mockResolvedValue(undefined),
    scheduleAlarm: jest.fn().mockResolvedValue(undefined),
    deleteLegacyChannels: jest.fn().mockResolvedValue(undefined),
    migrateLegacyAlarmChannels: jest.fn().mockResolvedValue(undefined),
  },
}))

const mockEmit = jest.fn()
let mockItems = []
jest.mock('@dosiq/core', () => ({
  createDoseInstanceRepository: () => ({ getWindow: jest.fn().mockResolvedValue([]) }),
  createCriticalAuditService: () => ({ emit: mockEmit }),
  buildDoseItemsFromInstances: () => mockItems,
  ensureInstancesUpTo: jest.fn().mockResolvedValue(undefined),
  getRawNow: () => new Date('2026-03-05T12:00:00.000Z'),
  addDays: (d, n) => new Date(d.getTime() + n * 86400000),
  parseISO: (s) => new Date(s),
}))

const item = (instanceId) => ({
  instanceId,
  scheduledFor: '2026-03-05T14:00:00.000Z',
  status: 'pending',
  critical: true,
  toleranceMinutes: 120,
  medicineName: 'Lantus',
})

const emittedIds = () => mockEmit.mock.calls.map((c) => c[0].doseInstanceId).sort()
const persisted = () => JSON.parse(mockStore.get(SCHEDULED_AUDIT_KEY) ?? '[]').sort()

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockStore.clear()
})

describe('syncAlarms — dedupe do alarm_scheduled só persiste emits aceitos (082 D1 · E-7)', () => {
  it('🔴 emit {ok:false} ⇒ id fora do AsyncStorage e reemitido no sync seguinte [PO-D1-5]', async () => {
    mockItems = [item('inst-1'), item('inst-2')]
    mockEmit.mockImplementation(async (evt) => ({ ok: evt.doseInstanceId !== 'inst-1' }))

    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })

    expect(emittedIds()).toEqual(['inst-1', 'inst-2'])
    expect(persisted()).toEqual(['inst-2'])

    // 2º sync: rede voltou. Só a que falhou é reemitida.
    mockEmit.mockClear()
    mockEmit.mockResolvedValue({ ok: true })
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })

    expect(emittedIds()).toEqual(['inst-1'])
    expect(persisted()).toEqual(['inst-1', 'inst-2'])
  })

  it('ids já emitidos seguem dedupados; os que saíram da janela são podados', async () => {
    mockStore.set(SCHEDULED_AUDIT_KEY, JSON.stringify(['inst-1', 'velha']))
    mockItems = [item('inst-1'), item('inst-2')]
    mockEmit.mockResolvedValue({ ok: true })

    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })

    expect(emittedIds()).toEqual(['inst-2'])
    expect(persisted()).toEqual(['inst-1', 'inst-2'])
  })

  it('🔴 emit que REJEITA (contrato quebrado) não marca o id como emitido', async () => {
    mockItems = [item('inst-1')]
    mockEmit.mockRejectedValue(new Error('boom'))

    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })

    expect(persisted()).toEqual([])
  })
})

// Spec 054 FR-005 (C-5 opção B): modo efetivo na 1ª emissão; dedupe intacto.
describe('syncAlarms — detail.mode do alarm_scheduled (054)', () => {
  const RN = require('react-native')
  const ORIGINAL_OS = RN.Platform.OS
  const { alarmService } = require('../alarmService')

  afterEach(() => {
    RN.Platform.OS = ORIGINAL_OS
    delete alarmService.getCriticalAlertStatus
  })

  it('iOS autorizado ⇒ detail.mode critical', async () => {
    RN.Platform.OS = 'ios'
    alarmService.getCriticalAlertStatus = jest.fn().mockResolvedValue(true)
    mockItems = [item('inst-1')]
    mockEmit.mockResolvedValue({ ok: true })
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(mockEmit.mock.calls[0][0].detail).toEqual({ mode: 'critical' })
  })

  it('🔴 leitura do modo LANÇA ⇒ prova do 082 sai mesmo assim, sem detail', async () => {
    RN.Platform.OS = 'ios'
    alarmService.getCriticalAlertStatus = jest.fn().mockRejectedValue(new Error('x'))
    mockItems = [item('inst-1')]
    mockEmit.mockResolvedValue({ ok: true })
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(emittedIds()).toEqual(['inst-1'])
    expect(mockEmit.mock.calls[0][0].detail).toBeUndefined()
  })

  it('Android ⇒ sem detail e sem consultar o status', async () => {
    RN.Platform.OS = 'android'
    alarmService.getCriticalAlertStatus = jest.fn()
    mockItems = [item('inst-1')]
    mockEmit.mockResolvedValue({ ok: true })
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(mockEmit.mock.calls[0][0].detail).toBeUndefined()
    expect(alarmService.getCriticalAlertStatus).not.toHaveBeenCalled()
  })
})

// 054 C-34: alarme que o aparelho sabe que não será entregue não vira prova do 082.
describe('syncAlarms — sem prova quando o alarme não será entregue (054 C-34)', () => {
  const { alarmService } = require('../alarmService')
  afterEach(() => { delete alarmService.getCriticalAlarmDeviceStatus })

  it('🔴 canal/notificações bloqueados ⇒ NÃO emite alarm_scheduled e não mexe no dedupe', async () => {
    mockStore.set(SCHEDULED_AUDIT_KEY, JSON.stringify(['inst-1']))
    alarmService.getCriticalAlarmDeviceStatus = jest.fn().mockResolvedValue({ kind: 'blocked', reason: 'channel' })
    mockItems = [item('inst-1'), item('inst-2')]
    mockEmit.mockResolvedValue({ ok: true })
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(mockEmit).not.toHaveBeenCalled()
    expect(persisted()).toEqual(['inst-1'])
    expect(alarmService.migrateLegacyAlarmChannels).toHaveBeenCalled()
  })

  it('degradado (toca, mas sem som/tela) ⇒ emite: o alarme chega', async () => {
    alarmService.getCriticalAlarmDeviceStatus = jest.fn().mockResolvedValue({ kind: 'degraded', fix: 'settings', reason: 'channel_silenced' })
    mockItems = [item('inst-1')]
    mockEmit.mockResolvedValue({ ok: true })
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(emittedIds()).toEqual(['inst-1'])
  })

  it('🔴 leitura do status LANÇA ⇒ emite como antes (fail-open)', async () => {
    alarmService.getCriticalAlarmDeviceStatus = jest.fn().mockRejectedValue(new Error('x'))
    mockItems = [item('inst-1')]
    mockEmit.mockResolvedValue({ ok: true })
    await syncAlarms({ userId: 'u1', protocols: [], tz: 'America/Sao_Paulo' })
    expect(emittedIds()).toEqual(['inst-1'])
  })
})
