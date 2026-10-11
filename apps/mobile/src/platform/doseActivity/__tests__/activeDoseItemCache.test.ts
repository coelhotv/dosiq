// Spec 101 C-31: DoseItem da dose da LA gravado para o "Adiar" offline.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { cacheActiveDoseItem, getCachedDoseItem, ACTIVE_DOSE_ITEM_KEY } from '../activeDoseItemCache'

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

const item = { instanceId: 'i1', medicineName: 'Glatus', scheduledFor: '2026-03-05T12:00:00.000Z', toleranceMinutes: 120, earlyWindowMinutes: 120, critical: true, treatmentPlanName: 'Plano X' }

describe('activeDoseItemCache', () => {
  it('grava e devolve só os campos da soneca, para a mesma dose', async () => {
    await cacheActiveDoseItem(item)
    const got = await getCachedDoseItem('i1')
    expect(got).toEqual({ instanceId: 'i1', medicineName: 'Glatus', scheduledFor: '2026-03-05T12:00:00.000Z', toleranceMinutes: 120, earlyWindowMinutes: 120, critical: true })
  })

  it('outra dose ⇒ null', async () => {
    await cacheActiveDoseItem(item)
    expect(await getCachedDoseItem('i2')).toBeNull()
  })

  it('JSON ilegível ⇒ null (nunca lança)', async () => {
    await AsyncStorage.setItem(ACTIVE_DOSE_ITEM_KEY, '{lixo')
    expect(await getCachedDoseItem('i1')).toBeNull()
  })

  it('sem instanceId ⇒ não grava', async () => {
    await cacheActiveDoseItem({ medicineName: 'x' })
    expect(await AsyncStorage.getItem(ACTIVE_DOSE_ITEM_KEY)).toBeNull()
  })
})
