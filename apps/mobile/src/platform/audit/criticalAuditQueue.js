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
  // Flag em memória para pular flush concorrente (reentrância — retorna skipped).
  let flushInFlight = false

  // Mutex: serializa TODA operação de read-modify-write no AsyncStorage. Sem isto, um enqueue(B)
  // que roda enquanto o flush(A) está entre o read e o write-back grava [A,B]; o flush então grava
  // os "remaining" (calculados sobre [A]) e clobbera B → perda de evento (race crítica, review #700).
  let lockChain = Promise.resolve()
  function withLock(op) {
    const run = lockChain.then(op, op) // encadeia mesmo se o anterior rejeitou (não deve — ops são fail-open)
    // Mantém a corrente viva sem propagar rejeição/valor pro próximo elo.
    lockChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

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

  function enqueue(payload) {
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
        // Fail-open: enqueue nunca lança.
      }
    })
  }

  async function flush(insertOne) {
    // Skip imediato (sem tomar o lock) se um flush já roda — evita empilhar drenagens.
    if (flushInFlight) {
      const state = await readState()
      return { inserted: 0, remaining: state.items.length, skipped: true }
    }
    flushInFlight = true
    try {
      // O read→process→write inteiro roda sob o lock: um enqueue concorrente espera e anexa
      // ao estado JÁ drenado (não é clobberado).
      return await withLock(async () => {
        const state = await readState()
        if (state.items.length === 0) {
          return { inserted: 0, remaining: 0 }
        }

        const remainingItems = []
        let inserted = 0

        // Loop sequencial (não Promise.all): a ordem importa para retry.
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
      })
    } catch {
      // Fail-open no storage.
      return { inserted: 0, remaining: 0 }
    } finally {
      flushInFlight = false
    }
  }

  function peek() {
    return withLock(async () => {
      const state = await readState()
      return { items: [...state.items], overflowDropped: state.overflowDropped }
    })
  }

  function clear() {
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
