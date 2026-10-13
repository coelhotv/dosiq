// AsyncStorage em memória: o teste exercita as chaves reais que o adapter grava.
const mockStore = new Map<string, string>()
jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(async (keys: string[]) => keys.map((k) => [k, mockStore.get(k) ?? null])),
  multiSet: jest.fn(async (pairs: [string, string][]) => {
    for (const [k, v] of pairs) mockStore.set(k, v)
  }),
}))

import { createAsyncStorageAdapter } from '../_asyncStorageAdapter'

describe('_asyncStorageAdapter — cache por fileKey (FR-021)', () => {
  beforeEach(() => mockStore.clear())
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('medicineDatabase mantém as chaves de produção (cache instalado não invalida)', async () => {
    const adapter = createAsyncStorageAdapter()
    await adapter.write('medicineDatabase', { manifest: { version: '1' }, data: [1] })
    expect(mockStore.get('@dosiq/anvisa-manifest')).toBe('{"version":"1"}')
    expect(mockStore.get('@dosiq/anvisa-data')).toBe('[1]')
  })

  it('outro fileKey ganha chave própria e não toca o medicineDatabase', async () => {
    const adapter = createAsyncStorageAdapter()
    await adapter.write('medicineDatabase', { manifest: { version: 'm' }, data: ['med'] })
    await adapter.write('laboratoryDatabase', { manifest: { version: 'l' }, data: ['lab'] })

    expect(await adapter.read('medicineDatabase')).toEqual({ manifest: { version: 'm' }, data: ['med'] })
    expect(await adapter.read('laboratoryDatabase')).toEqual({ manifest: { version: 'l' }, data: ['lab'] })
    expect(mockStore.get('@dosiq/anvisa-manifest:laboratoryDatabase')).toBe('{"version":"l"}')
  })

  it('cache incompleto ⇒ null', async () => {
    mockStore.set('@dosiq/anvisa-manifest', '{}')
    expect(await createAsyncStorageAdapter().read('medicineDatabase')).toBeNull()
  })

  it('JSON corrompido ⇒ null sem lançar', async () => {
    mockStore.set('@dosiq/anvisa-manifest', '{')
    mockStore.set('@dosiq/anvisa-data', '[]')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await createAsyncStorageAdapter().read('medicineDatabase')).toBeNull()
    warn.mockRestore()
  })
})
