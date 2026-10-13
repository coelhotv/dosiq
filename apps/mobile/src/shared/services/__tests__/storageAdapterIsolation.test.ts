// Guard do PO-8 (FR-021): gravar o índice CMED nunca altera o cache do autocomplete atual.
// Os dois adapters reais sobre um AsyncStorage e um disco em memória compartilhados.
const mockStore = new Map<string, string>()
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v)
  }),
  multiGet: jest.fn(async (keys: string[]) => keys.map((k) => [k, mockStore.get(k) ?? null])),
  multiSet: jest.fn(async (pairs: [string, string][]) => {
    for (const [k, v] of pairs) mockStore.set(k, v)
  }),
}))

const mockDisk = new Map<string, string>()
jest.mock('expo-file-system', () => {
  const join = (parent: { uri: string }, name: string) => `${parent.uri}/${name}`
  class File {
    uri: string
    name: string
    constructor(parent: { uri: string }, name: string) {
      this.uri = join(parent, name)
      this.name = name
    }
    get exists() {
      return mockDisk.has(this.uri)
    }
    create() {
      mockDisk.set(this.uri, '')
    }
    write(content: string) {
      mockDisk.set(this.uri, content)
    }
    async text() {
      return mockDisk.get(this.uri) as string
    }
    delete() {
      mockDisk.delete(this.uri)
    }
  }
  class Directory {
    uri: string
    constructor(parent: { uri: string }, name: string) {
      this.uri = join(parent, name)
    }
    create() {}
    list() {
      return [...mockDisk.keys()]
        .filter((uri) => uri.startsWith(`${this.uri}/`))
        .map((uri) => new File(this, uri.slice(this.uri.length + 1)))
    }
  }
  return { File, Directory, Paths: { cache: { uri: 'file:///cache' } } }
})

import { createAsyncStorageAdapter } from '../_asyncStorageAdapter'
import { createFileSystemStorageAdapter } from '../_fileSystemStorageAdapter'

const medicines = { manifest: { version: '1.1.11', cachedAt: 'x' }, data: [{ name: 'Paracetamol' }] }
const cmed = { manifest: { version: '1.1.11', cachedAt: 'y' }, data: { v: 1, n: 0, cols: {}, dict: {} } }

describe('isolamento dos caches ANVISA por fileKey (PO-8 guard)', () => {
  beforeEach(() => {
    mockStore.clear()
    mockDisk.clear()
  })
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it.each([
    ['medicineDatabase → cmedIndex', true],
    ['cmedIndex → medicineDatabase', false],
  ])('grava em sequência (%s) e lê os dois íntegros', async (_label, medicinesFirst) => {
    const asyncAdapter = createAsyncStorageAdapter()
    const diskAdapter = createFileSystemStorageAdapter()
    const steps = [
      () => asyncAdapter.write('medicineDatabase', medicines),
      () => diskAdapter.write('cmedIndex', cmed),
    ]
    for (const step of medicinesFirst ? steps : steps.reverse()) await step()

    expect(await asyncAdapter.read('medicineDatabase')).toEqual(medicines)
    expect(await diskAdapter.read('cmedIndex')).toEqual(cmed)
    // FR-022: o índice não entra no AsyncStorage — só o manifest com o ponteiro.
    expect([...mockStore.values()].some((v) => v.includes('"cols"'))).toBe(false)
  })
})
