import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  setSnoozeAnchors,
  getSnoozeAnchors,
  mergeSnoozeAnchors,
  SNOOZE_ANCHOR_KEY,
  SNOOZE_ANCHOR_TTL_MS,
} from '../snoozeAnchorStore'

const T = 1_780_000_000_000

describe('snoozeAnchorStore (spec 101 FR-006)', () => {
  // O mock global (jest-setup) não guarda estado — memória local por teste.
  let mem: Record<string, string>
  beforeEach(() => {
    mem = {}
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (k) => mem[k] ?? null)
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (k, v) => {
      mem[k] = v
    })
  })
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('grava e lê a âncora de cada ocorrência', async () => {
    await setSnoozeAnchors(['a', 'b'], T + 300_000, T)
    expect(await getSnoozeAnchors(T)).toEqual({ a: T + 300_000, b: T + 300_000 })
  })

  it('poda âncoras vencidas além do TTL', async () => {
    await setSnoozeAnchors(['velha'], T, T)
    await setSnoozeAnchors(['nova'], T + SNOOZE_ANCHOR_TTL_MS + 60_000, T + SNOOZE_ANCHOR_TTL_MS + 1)
    expect(await getSnoozeAnchors(T + SNOOZE_ANCHOR_TTL_MS + 1)).toEqual({ nova: T + SNOOZE_ANCHOR_TTL_MS + 60_000 })
  })

  it('FM-14: storage corrompido ou falho → {} (fail-open)', async () => {
    await AsyncStorage.setItem(SNOOZE_ANCHOR_KEY, '{lixo')
    expect(await getSnoozeAnchors(T)).toEqual({})
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('io'))
    expect(await getSnoozeAnchors(T)).toEqual({})
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('io'))
    await expect(setSnoozeAnchors(['x'], T, T)).resolves.toBeUndefined()
  })

  it('mergeSnoozeAnchors: âncora local supre o banco zerado pelo claim (F3) e vence a mais antiga', () => {
    const iso = new Date(T).toISOString()
    const items = [
      { instanceId: 'a', snoozedUntil: null },
      { instanceId: 'b', snoozedUntil: iso },
      { instanceId: 'c', snoozedUntil: iso },
    ]
    const out = mergeSnoozeAnchors(items, { a: T + 1, c: T - 1 })
    expect(out[0].snoozedUntil).toBe(T + 1)
    expect(out[1].snoozedUntil).toBe(iso)
    expect(out[2].snoozedUntil).toBe(iso)
  })
})
