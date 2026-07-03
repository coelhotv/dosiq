import AsyncStorage from '@react-native-async-storage/async-storage'

export const AUDIT_QUEUE_KEY = '@dosiq/audit/queue'
export const AUDIT_QUEUE_CAP = 200

// Fila offline de eventos de auditoria de dose crítica (spec 042 Slice B, CON-031).
// Persistência via AsyncStorage; drenada no foreground. NÃO importa supabase —
// o inserter é injetado no flush() para manter o cold-start do background handler
// leve (AP-205).
export function createCriticalAuditQueue({
  storage = AsyncStorage,
  key = AUDIT_QUEUE_KEY,
  cap = AUDIT_QUEUE_CAP,
} = {}) {
  // Flag em memória para evitar flush concorrente (reentrância).
  let flushInFlight = false

  async function readState() {
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
      // JSON corrompido ou storage indisponível → trata como vazio (fail-open).
      return { items: [], overflowDropped: 0 }
    }
  }

  async function writeState(state) {
    try {
      await storage.setItem(key, JSON.stringify(state))
    } catch {
      // Fail-open: nunca lança em erro de storage.
    }
  }

  async function enqueue(payload) {
    try {
      const state = await readState()
      state.items.push(payload)
      while (state.items.length > cap) {
        state.items.shift()
        state.overflowDropped += 1
      }
      await writeState(state)
    } catch {
      // Fail-open: enqueue nunca lança.
    }
  }

  async function flush(insertOne) {
    if (flushInFlight) {
      const state = await readState()
      return { inserted: 0, remaining: state.items.length, skipped: true }
    }

    flushInFlight = true
    try {
      const state = await readState()
      if (state.items.length === 0) {
        return { inserted: 0, remaining: 0 }
      }

      const remainingItems = []
      let inserted = 0

      // Loop sequencial (não Promise.all): a ordem importa para retry e a
      // reentrância depende do estado consistente entre iterações.
      for (const item of state.items) {
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

      await writeState({ items: remainingItems, overflowDropped: state.overflowDropped })
      return { inserted, remaining: remainingItems.length }
    } catch {
      // Fail-open no storage.
      return { inserted: 0, remaining: 0 }
    } finally {
      flushInFlight = false
    }
  }

  async function peek() {
    const state = await readState()
    return { items: [...state.items], overflowDropped: state.overflowDropped }
  }

  async function clear() {
    try {
      await storage.removeItem(key)
    } catch {
      // Fail-open.
    }
  }

  return { enqueue, flush, peek, clear }
}
