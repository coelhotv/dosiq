// Testes para installId.ts (spec 095, FR-003/FR-011, PO-3/PO-SEC-3).

import { describe, it, expect, afterEach } from '@jest/globals'

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>()
  return {
    __store: store,
    getItem: jest.fn(async (k: string) => store.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
  }
})

import AsyncStorageImport from '@react-native-async-storage/async-storage'
const AsyncStorage = AsyncStorageImport as any

import { getInstallId, INSTALL_ID_KEY } from './installId'
import { isDeviceKey } from '../session/localDataWipe'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('getInstallId', () => {
  afterEach(() => {
    AsyncStorage.__store.clear()
    jest.clearAllMocks()
  })

  it('gera um UUID v4 e o persiste', async () => {
    const id = await getInstallId()
    expect(id).toMatch(UUID_V4)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(INSTALL_ID_KEY, id)
  })

  it('devolve o mesmo id em chamadas seguidas', async () => {
    const first = await getInstallId()
    const second = await getInstallId()
    expect(second).toBe(first)
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1)
  })

  it('duas chamadas concorrentes resolvem um único id', async () => {
    const [a, b] = await Promise.all([getInstallId(), getInstallId()])
    expect(a).toBe(b)
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1)
  })

  it('storage apagado (wipe do logout) ⇒ id novo, sem cache em memória', async () => {
    const before = await getInstallId()
    AsyncStorage.__store.clear()
    const after = await getInstallId()
    expect(after).toMatch(UUID_V4)
    expect(after).not.toBe(before)
  })

  it('valor guardado inválido é substituído', async () => {
    AsyncStorage.__store.set(INSTALL_ID_KEY, 'lixo')
    expect(await getInstallId()).toMatch(UUID_V4)
  })

  it('falha do storage ⇒ null, nunca lança', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('disk'))
    await expect(getInstallId()).resolves.toBeNull()
  })

  it('a chave fica fora da allowlist do wipe (gira por sessão — FR-011)', () => {
    expect(isDeviceKey(INSTALL_ID_KEY)).toBe(false)
  })
})
