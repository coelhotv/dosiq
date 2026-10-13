// Fronteiras mockadas: expo-file-system (disco em Map) e AsyncStorage (Map).
const mockDisk = new Map<string, string>()
const mockFailDelete = { on: false }
jest.mock('expo-file-system', () => {
  const join = (parent: string | { uri: string }, name: string) =>
    `${typeof parent === 'string' ? parent : parent.uri}/${name}`
  class File {
    uri: string
    name: string
    constructor(parent: string | { uri: string }, name: string) {
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
      const value = mockDisk.get(this.uri)
      if (value === undefined) throw new Error('not found')
      return value
    }
    delete() {
      if (mockFailDelete.on) throw new Error('EACCES')
      mockDisk.delete(this.uri)
    }
  }
  class Directory {
    uri: string
    constructor(parent: string | { uri: string }, name: string) {
      this.uri = join(parent, name)
    }
    create() {}
    list() {
      const prefix = `${this.uri}/`
      return [...mockDisk.keys()]
        .filter((uri) => uri.startsWith(prefix))
        .map((uri) => new File(this.uri, uri.slice(prefix.length)))
    }
  }
  return { File, Directory, Paths: { cache: { uri: 'file:///cache' } } }
})

const mockStore = new Map<string, string>()
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v)
  }),
}))

import {
  createFileSystemStorageAdapter,
  FILE_MANIFEST_KEY_PREFIX,
} from '../_fileSystemStorageAdapter'

const DIR = 'file:///cache/anvisa'
const index = { v: 1, n: 1, cols: { ean: ['7891317020576'] } }

function anvisaFiles() {
  return [...mockDisk.keys()].filter((uri) => uri.startsWith(`${DIR}/`))
}

describe('_fileSystemStorageAdapter — dado em disco, manifest no AsyncStorage (FR-022)', () => {
  beforeEach(() => {
    mockDisk.clear()
    mockStore.clear()
    mockFailDelete.on = false
  })
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it('grava e lê de volta íntegro; AsyncStorage guarda só o manifest', async () => {
    const adapter = createFileSystemStorageAdapter()
    await adapter.write('cmedIndex', { manifest: { version: '1.1.11' }, data: index })

    expect(await adapter.read('cmedIndex')).toEqual({ manifest: { version: '1.1.11' }, data: index })
    const stored = JSON.parse(mockStore.get(`${FILE_MANIFEST_KEY_PREFIX}cmedIndex`) as string)
    expect(stored.manifest).toEqual({ version: '1.1.11' })
    expect(stored.dataFile).toMatch(/^cmedIndex\.\d+\.json$/)
    expect(anvisaFiles()).toEqual([`${DIR}/${stored.dataFile}`])
  })

  it('nova gravação aponta para arquivo novo e apaga o anterior', async () => {
    const adapter = createFileSystemStorageAdapter()
    await adapter.write('cmedIndex', { manifest: { version: 'a' }, data: { n: 1 } })
    await adapter.write('cmedIndex', { manifest: { version: 'b' }, data: { n: 2 } })

    expect(await adapter.read('cmedIndex')).toEqual({ manifest: { version: 'b' }, data: { n: 2 } })
    expect(anvisaFiles()).toHaveLength(1)
  })

  it('órfão de gravação interrompida (sem manifest) some na próxima gravação; outro fileKey fica', async () => {
    mockDisk.set(`${DIR}/cmedIndex.1.json`, '{"v":1,')
    mockDisk.set(`${DIR}/other.1.json`, '{}')
    await createFileSystemStorageAdapter().write('cmedIndex', { manifest: {}, data: { n: 3 } })

    expect(mockDisk.has(`${DIR}/cmedIndex.1.json`)).toBe(false)
    expect(mockDisk.has(`${DIR}/other.1.json`)).toBe(true)
  })

  it('falha ao apagar órfão não derruba a gravação', async () => {
    mockDisk.set(`${DIR}/cmedIndex.1.json`, '{}')
    mockFailDelete.on = true
    const adapter = createFileSystemStorageAdapter()
    await adapter.write('cmedIndex', { manifest: { version: 'x' }, data: { n: 4 } })
    expect(await adapter.read('cmedIndex')).toEqual({ manifest: { version: 'x' }, data: { n: 4 } })
  })

  it('sem manifest ⇒ null', async () => {
    expect(await createFileSystemStorageAdapter().read('cmedIndex')).toBeNull()
  })

  it('arquivo apagado pelo SO ⇒ null (loader baixa de novo)', async () => {
    const adapter = createFileSystemStorageAdapter()
    await adapter.write('cmedIndex', { manifest: {}, data: index })
    mockDisk.clear()
    expect(await adapter.read('cmedIndex')).toBeNull()
  })

  it.each([
    ['arquivo truncado', () => mockDisk.set(`${DIR}/cmedIndex.9.json`, '{"v":1,'), '{"manifest":{},"dataFile":"cmedIndex.9.json"}'],
    ['manifest corrompido', () => {}, '{'],
    ['manifest sem dataFile', () => {}, '{"manifest":{}}'],
    ['dataFile de outro fileKey', () => mockDisk.set(`${DIR}/other.1.json`, '{}'), '{"manifest":{},"dataFile":"other.1.json"}'],
    ['dataFile com path traversal', () => {}, '{"manifest":{},"dataFile":"cmedIndex.1.json/../../x"}'],
  ])('%s ⇒ null sem lançar', async (_label, seed, rawManifest) => {
    seed()
    mockStore.set(`${FILE_MANIFEST_KEY_PREFIX}cmedIndex`, rawManifest)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await createFileSystemStorageAdapter().read('cmedIndex')).toBeNull()
    warn.mockRestore()
  })

  it.each(['', '../x', 'a/b', 'cmed.idx'])('fileKey inválido %p: write lança, read = null', async (fileKey) => {
    const adapter = createFileSystemStorageAdapter()
    await expect(adapter.write(fileKey, { manifest: {}, data: {} })).rejects.toThrow()
    expect(await adapter.read(fileKey)).toBeNull()
  })
})
