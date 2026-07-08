import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  isAlarmEnabled,
  setAlarmEnabled,
  hasSeenAlarmNudge,
  markAlarmNudgeSeen,
  ALARM_ENABLED_KEY,
  ALARM_NUDGE_SEEN_KEY,
} from '../alarmEnabledStore'

const mockedGetItem = AsyncStorage.getItem as jest.Mock

afterEach(() => {
  jest.clearAllMocks()
})

describe('alarmEnabledStore', () => {
  it('default OFF quando não há valor persistido', async () => {
    mockedGetItem.mockResolvedValueOnce(null)
    expect(await isAlarmEnabled()).toBe(false)
  })

  it('lê true quando persistido', async () => {
    mockedGetItem.mockResolvedValueOnce('true')
    expect(await isAlarmEnabled()).toBe(true)
  })

  it('default OFF em erro de storage (fail-safe)', async () => {
    mockedGetItem.mockRejectedValueOnce(new Error('boom'))
    expect(await isAlarmEnabled()).toBe(false)
  })

  it('persiste o toggle como string', async () => {
    await setAlarmEnabled(true)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ALARM_ENABLED_KEY, 'true')
    await setAlarmEnabled(false)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ALARM_ENABLED_KEY, 'false')
  })

  it('nudge: não visto por padrão, marca visto', async () => {
    mockedGetItem.mockResolvedValueOnce(null)
    expect(await hasSeenAlarmNudge()).toBe(false)
    await markAlarmNudgeSeen()
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ALARM_NUDGE_SEEN_KEY, 'true')
  })

  it('nudge: erro de leitura → não insistir (true)', async () => {
    mockedGetItem.mockRejectedValueOnce(new Error('x'))
    expect(await hasSeenAlarmNudge()).toBe(true)
  })
})
