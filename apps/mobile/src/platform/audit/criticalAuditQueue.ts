import AsyncStorage from '@react-native-async-storage/async-storage'

export const AUDIT_QUEUE_KEY = '@dosiq/audit/queue'
export const AUDIT_QUEUE_CAP = 200

export type AuditQueueItem = Record<string, unknown>

interface AuditQueueState {
  items: AuditQueueItem[]
  overflowDropped: number
}

interface AuditQueueStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

interface CreateCriticalAuditQueueOptions {
  storage?: AuditQueueStorage
  key?: string
  cap?: number
}

export type FlushInsertOne = (item: AuditQueueItem) => Promise<boolean | { ok: boolean }>

export interface FlushResult {
  inserted: number
  remaining: number
  skipped?: boolean
}

// Fila offline de eventos de auditoria de dose crítica (spec 042 Slice B, CON-031).
// Persistência via AsyncStorage; drenada no foreground. NÃO importa supabase —
// o inserter é injetado no flush() para manter o cold-start do background handler
// leve (AP-205).
async function _readQueueState(storage: AuditQueueStorage, key: string): Promise<AuditQueueState> {
  try {
    const raw = await storage.getItem(key)
    if (!raw) return { items: [], overflowDropped: 0 }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) {
      return { items: [], overflowDropped: 0 }
    }
    return {
      items: parsed.items,
      overflowDropped: Number.isInteger(parsed.overflowDropped) ? parsed.overflowDropped : 0,
    }
  } catch {
    return { items: [], overflowDropped: 0 }
  }
}

async function _writeQueueState(storage: AuditQueueStorage, key: string, state: AuditQueueState): Promise<void> {
  try {
    await storage.setItem(key, JSON.stringify(state))
  } catch {
    // Fail-open
  }
}

async function _processFlushItems(items: AuditQueueItem[], insertOne: FlushInsertOne) {
  const remainingItems: AuditQueueItem[] = []
  let inserted = 0
  for (const item of items) {
    let ok = false
    try {
      const result = await insertOne(item)
      if (result === true) {
        ok = true
      } else if (result && typeof result === 'object') {
        ok = Boolean(result.ok)
      } else {
        ok = Boolean(result)
      }
    } catch {
      ok = false
    }

    if (ok) {
      inserted += 1
    } else {
      remainingItems.push(item)
    }
  }
  return { inserted, remainingItems }
}

export function createCriticalAuditQueue({
  storage = AsyncStorage,
  key = AUDIT_QUEUE_KEY,
  cap = AUDIT_QUEUE_CAP,
}: CreateCriticalAuditQueueOptions = {}) {
  let flushInFlight = false
  let lockChain: Promise<unknown> = Promise.resolve()

  function withLock<T>(op: () => Promise<T>): Promise<T> {
    const run = lockChain.then(op, op)
    lockChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const readState = () => _readQueueState(storage, key)
  const writeState = (s: AuditQueueState) => _writeQueueState(storage, key, s)

  function enqueue(payload: AuditQueueItem): Promise<void> {
    return withLock(async () => {
      try {
        const state = await readState()
        state.items.push(payload)
        while (state.items.length > cap) {
          state.items.shift()
          state.overflowDropped += 1
        }
        await writeState(state)
      } catch {
        // Fail-open
      }
    })
  }

  async function flush(insertOne: FlushInsertOne): Promise<FlushResult> {
    if (flushInFlight) {
      const state = await readState()
      return { inserted: 0, remaining: state.items.length, skipped: true }
    }
    flushInFlight = true
    try {
      return await withLock(async (): Promise<FlushResult> => {
        const state = await readState()
        if (state.items.length === 0) {
          return { inserted: 0, remaining: 0 }
        }

        const { inserted, remainingItems } = await _processFlushItems(state.items, insertOne)

        await writeState({ items: remainingItems, overflowDropped: state.overflowDropped })
        return { inserted, remaining: remainingItems.length }
      })
    } catch {
      // Fail-open no storage.
      return { inserted: 0, remaining: 0 }
    } finally {
      flushInFlight = false
    }
  }

  function peek(): Promise<AuditQueueState> {
    return withLock(async () => {
      const state = await readState()
      return { items: [...state.items], overflowDropped: state.overflowDropped }
    })
  }

  function clear(): Promise<void> {
    return withLock(async () => {
      try {
        await storage.removeItem(key)
      } catch {
        // Fail-open.
      }
    })
  }

  return { enqueue, flush, peek, clear }
}
