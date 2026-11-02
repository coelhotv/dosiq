import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  hasSeenAlarmNudge,
  markAlarmNudgeSeen,
  ALARM_NUDGE_SEEN_KEY,
} from '../alarmEnabledStore'

const mockedGetItem = AsyncStorage.getItem as jest.Mock

afterEach(() => {
  jest.clearAllMocks()
})

describe('alarmEnabledStore', () => {
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
