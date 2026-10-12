// Spec 084 PO-5 / INV-4: com a fila REAL, a rajada de eventos de superfície não desloca nenhum beacon
// de alarme, mesmo com a fila de alarme no cap. Overflow só conta no que foi descartado.

import { createCriticalAuditQueue, AUDIT_QUEUE_KEY, AUDIT_QUEUE_CAP } from '../criticalAuditQueue'

const SURFACE_KEY = '@dosiq/audit/surface-queue'

function memoryStorage() {
  const m = new Map()
  return {
    getItem: async (k) => (m.has(k) ? m.get(k) : null),
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k),
  }
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('INV-4 — filas de alarme e superfície isoladas', () => {
  it('alarme no cap + 300 eventos de superfície ⇒ zero beacon de alarme descartado', async () => {
    const storage = memoryStorage()
    const alarm = createCriticalAuditQueue({ storage, key: AUDIT_QUEUE_KEY })
    const surface = createCriticalAuditQueue({ storage, key: SURFACE_KEY })
    for (let i = 0; i < AUDIT_QUEUE_CAP; i++) await alarm.enqueue({ event: 'alarm_fired', i })
    for (let i = 0; i < 300; i++) await surface.enqueue({ event: 'surface_transitioned', i })

    const a = await alarm.peek()
    expect(a.items).toHaveLength(AUDIT_QUEUE_CAP)
    expect(a.overflowDropped).toBe(0)
    expect(a.items.every((x) => x.event === 'alarm_fired')).toBe(true)

    const s = await surface.peek()
    expect(s.items).toHaveLength(AUDIT_QUEUE_CAP)
    expect(s.overflowDropped).toBe(100) // overflow contabilizado só na fila que descartou
  })
})
