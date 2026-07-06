import { createCriticalAuditQueue, AUDIT_QUEUE_KEY } from '../criticalAuditQueue'

// Mock in-memory de storage (AsyncStorage-like), injetável no factory.
function createMockStorage(overrides = {}) {
  const store = {}
  return {
    store,
    getItem: jest.fn(async (k) => (k in store ? store[k] : null)),
    setItem: jest.fn(async (k, v) => {
      store[k] = v
    }),
    removeItem: jest.fn(async (k) => {
      delete store[k]
    }),
    ...overrides,
  }
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('criticalAuditQueue', () => {
  test('1. enqueue em storage vazio persiste 1 item', async () => {
    const storage = createMockStorage()
    const queue = createCriticalAuditQueue({ storage })

    await queue.enqueue({ event: 'dose_critical', dose_id: '1' })

    const state = await queue.peek()
    expect(state.items).toHaveLength(1)
    expect(storage.setItem).toHaveBeenCalledWith(AUDIT_QUEUE_KEY, expect.any(String))
  })

  test('2. JSON corrompido é tratado como vazio, novo item não se perde', async () => {
    const storage = createMockStorage()
    storage.store[AUDIT_QUEUE_KEY] = '{bad'
    const queue = createCriticalAuditQueue({ storage })

    await queue.enqueue({ event: 'dose_critical', dose_id: '2' })

    const state = await queue.peek()
    expect(state.items).toHaveLength(1)
  })

  test('3. cap: 201 enqueues mantém 200 itens, overflowDropped=1, remove o mais antigo', async () => {
    const storage = createMockStorage()
    const queue = createCriticalAuditQueue({ storage, cap: 200 })

    for (let i = 0; i < 201; i += 1) {
      await queue.enqueue({ event: 'dose_critical', dose_id: String(i) })
    }

    const state = await queue.peek()
    expect(state.items).toHaveLength(200)
    expect(state.overflowDropped).toBe(1)
    expect(state.items.find((item) => item.dose_id === '0')).toBeUndefined()
    expect(state.items.find((item) => item.dose_id === '200')).toBeDefined()
  })

  test('4. flush com insertOne sempre ok insere N vezes em ordem e esvazia a fila', async () => {
    const storage = createMockStorage()
    const queue = createCriticalAuditQueue({ storage })
    await queue.enqueue({ event: 'A' })
    await queue.enqueue({ event: 'B' })
    await queue.enqueue({ event: 'C' })

    const calls = []
    const insertOne = jest.fn(async (item) => {
      calls.push(item.event)
      return true
    })

    const result = await queue.flush(insertOne)

    expect(insertOne).toHaveBeenCalledTimes(3)
    expect(calls).toEqual(['A', 'B', 'C'])
    expect(result).toEqual({ inserted: 3, remaining: 0 })

    const state = await queue.peek()
    expect(state.items).toHaveLength(0)
  })

  test('5. flush com fila vazia não chama insertOne', async () => {
    const storage = createMockStorage()
    const queue = createCriticalAuditQueue({ storage })
    const insertOne = jest.fn()

    const result = await queue.flush(insertOne)

    expect(insertOne).not.toHaveBeenCalled()
    expect(result).toEqual({ inserted: 0, remaining: 0 })
  })

  test('6. flush com insertOne rejeitando sempre mantém todos os itens', async () => {
    const storage = createMockStorage()
    const queue = createCriticalAuditQueue({ storage })
    await queue.enqueue({ event: 'A' })
    await queue.enqueue({ event: 'B' })

    const insertOne = jest.fn(async () => {
      throw new Error('insert failed')
    })

    const result = await queue.flush(insertOne)

    expect(insertOne).toHaveBeenCalledTimes(2)
    expect(result.remaining).toBe(2)
    expect(result.inserted).toBe(0)
  })

  test('7. flush parcial: falha só no 2º de 3, remove os OK e mantém 1', async () => {
    const storage = createMockStorage()
    const queue = createCriticalAuditQueue({ storage })
    await queue.enqueue({ event: 'A' })
    await queue.enqueue({ event: 'X' })
    await queue.enqueue({ event: 'C' })

    const insertOne = jest.fn(async (item) => {
      if (item.event === 'X') {
        throw new Error('falha no item X')
      }
      return true
    })

    const result = await queue.flush(insertOne)

    expect(result.inserted).toBe(2)
    expect(result.remaining).toBe(1)

    const state = await queue.peek()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].event).toBe('X')
  })

  test('8. re-entrância: segundo flush concorrente retorna skipped:true', async () => {
    const storage = createMockStorage()
    const queue = createCriticalAuditQueue({ storage })
    await queue.enqueue({ event: 'A' })

    // Deferred manual para segurar o primeiro flush em andamento (sem timers reais).
    let releaseFirstInsert
    const gate = new Promise((resolve) => {
      releaseFirstInsert = resolve
    })

    const insertOne = jest.fn(async () => {
      await gate
      return true
    })

    const firstFlushPromise = queue.flush(insertOne)
    // Deixa o primeiro flush marcar flushInFlight antes de chamar o segundo.
    await Promise.resolve()
    await Promise.resolve()

    const secondResult = await queue.flush(insertOne)
    expect(secondResult.skipped).toBe(true)
    expect(secondResult.inserted).toBe(0)
    expect(secondResult.remaining).toBe(1)

    releaseFirstInsert()
    const firstResult = await firstFlushPromise
    expect(firstResult.inserted).toBe(1)
    expect(firstResult.remaining).toBe(0)
  })

  test('9. fail-open: setItem rejeitando no enqueue não lança', async () => {
    const storage = createMockStorage({
      setItem: jest.fn(async () => {
        throw new Error('storage indisponível')
      }),
    })
    const queue = createCriticalAuditQueue({ storage })

    await expect(queue.enqueue({ event: 'A' })).resolves.not.toThrow()
  })

  test('10. race enqueue↔flush: item enfileirado durante o flush NÃO é perdido (mutex, review #700)', async () => {
    const storage = createMockStorage()
    storage.store[AUDIT_QUEUE_KEY] = JSON.stringify({ items: [{ event: 'A' }], overflowDropped: 0 })
    const queue = createCriticalAuditQueue({ storage })

    // insertOne do 'A' fica pendente → flush segura o lock durante o await.
    let releaseInsert
    const insertGate = new Promise((r) => {
      releaseInsert = r
    })
    const insertOne = jest.fn(async () => {
      await insertGate
      return { ok: true }
    })

    const flushPromise = queue.flush(insertOne)
    await Promise.resolve() // deixa o flush entrar no lock + começar o insert de 'A'

    // Enqueue de 'B' durante o flush: espera o lock e anexa ao estado pós-drenagem (sem clobber).
    const enqueuePromise = queue.enqueue({ event: 'B' })

    releaseInsert()
    await flushPromise
    await enqueuePromise

    const state = await queue.peek()
    expect(state.items).toEqual([{ event: 'B' }]) // 'A' drenado, 'B' preservado
  })
})
