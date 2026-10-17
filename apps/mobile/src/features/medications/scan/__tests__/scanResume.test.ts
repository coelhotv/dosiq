// 066 D1 (C-D1-6) — retomar o scan depois dos Ajustes do iPhone: a marca vale uma vez, por 5 min,
// e alarme/notificação na abertura têm prioridade (R-309).

import AsyncStorage from '@react-native-async-storage/async-storage'
import notifee from '@notifee/react-native'
import * as Notifications from 'expo-notifications'
import { SCAN_RESUME_KEY, SCAN_RESUME_TTL_MS, markScanResume, shouldResumeScan, takeScanResume } from '../scanResume'
import { resumeScanIfMarked } from '../useScanResume'

const mockCrossTab = jest.fn()
const mockRoute = { current: 'Tabs' as string | null }

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(async () => null),
}))
jest.mock('@navigation/navigateCrossTab', () => ({
  navigateCrossTab: (...args: any[]) => mockCrossTab(...args),
}))
jest.mock('@navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true, getCurrentRoute: () => ({ name: mockRoute.current }) },
}))

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  mockRoute.current = 'Tabs'
  ;(AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => store.get(k) ?? null)
  ;(AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => {
    store.set(k, v)
  })
  ;(AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k: string) => {
    store.delete(k)
  })
  jest.spyOn(notifee, 'getInitialNotification').mockResolvedValue(null as any)
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('shouldResumeScan', () => {
  const base = { now: 1_000_000, launchedByNotification: false, currentRoute: 'Tabs', alarmRoute: 'AlarmFullScreen' }

  it('marca recente → retoma', () => {
    expect(shouldResumeScan({ ...base, marker: { at: base.now - 60_000, entryPoint: 'medicine_form' } })).toBe(true)
  })

  it.each([
    ['sem marca', { marker: null }],
    ['marca velha (> 5 min)', { marker: { at: 1_000_000 - SCAN_RESUME_TTL_MS - 1, entryPoint: 'x' } }],
    ['marca no futuro (relógio mexido)', { marker: { at: 1_000_000 + 10, entryPoint: 'x' } }],
    ['aberto por alarme/notificação', { marker: { at: 999_000, entryPoint: 'x' }, launchedByNotification: true }],
    ['tela do alarme na frente', { marker: { at: 999_000, entryPoint: 'x' }, currentRoute: 'AlarmFullScreen' }],
  ])('%s → não retoma', (_label, over) => {
    expect(shouldResumeScan({ ...base, ...(over as any) })).toBe(false)
  })
})

describe('resumeScanIfMarked', () => {
  it('com marca recente abre o cadastro já com o scanner, e a marca some', async () => {
    await markScanResume('medicines_list', Date.now())
    expect(await resumeScanIfMarked()).toBe(true)
    expect(mockCrossTab).toHaveBeenCalledWith('Tratamentos', 'MedicineCreate', { startScan: true, scanEntryPoint: 'medicines_list' })
    expect(store.has(SCAN_RESUME_KEY)).toBe(false)
    expect(await resumeScanIfMarked()).toBe(false)
  })

  it('abertura pelo alarme (notifee) descarta a marca sem navegar', async () => {
    jest.spyOn(notifee, 'getInitialNotification').mockResolvedValue({ notification: {} } as any)
    await markScanResume('medicine_form', Date.now())
    expect(await resumeScanIfMarked()).toBe(false)
    expect(mockCrossTab).not.toHaveBeenCalled()
    expect(store.has(SCAN_RESUME_KEY)).toBe(false)
  })

  it('abertura por toque em push descarta a marca sem navegar', async () => {
    ;(Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValueOnce({ notification: {} })
    await markScanResume('medicine_form', Date.now())
    expect(await resumeScanIfMarked()).toBe(false)
    expect(mockCrossTab).not.toHaveBeenCalled()
  })

  it('marca corrompida não quebra nada', async () => {
    store.set(SCAN_RESUME_KEY, '{lixo')
    expect(await takeScanResume()).toBeNull()
    expect(await resumeScanIfMarked()).toBe(false)
  })
})
