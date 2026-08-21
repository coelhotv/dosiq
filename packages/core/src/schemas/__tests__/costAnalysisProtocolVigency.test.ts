import { describe, it, expect, afterEach, vi } from 'vitest'
import { ProtocolSchema } from '../costAnalysisSchema'

/**
 * 064 / PO-4 — CONSERVAÇÃO dos campos de vigência no `ProtocolSchema`.
 *
 * O Zod estripa campo não declarado em SILÊNCIO: sem `start_date`/`end_date` no schema,
 * `calculateMonthlyCosts`/`calculateRealCosts` entregariam ao core protocolos sem vigência,
 * o filtro veria `undefined` e todo tratamento encerrado seguiria contando como vivo —
 * teste verde sobre bug vivo (classe AP-214/AP-333). Nem `tsc` nem `lint` pegam isso.
 */
describe('ProtocolSchema — campos de vigência (064)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('CONSERVA start_date e end_date após safeParse', () => {
    const result = ProtocolSchema.safeParse({
      medicine_id: 'med-1',
      active: true,
      dosage_per_intake: 1,
      time_schedule: ['08:00'],
      start_date: '2026-01-01',
      end_date: '2026-07-31',
    })

    expect(result.success).toBe(true)
    if (result.success === false) return
    expect(result.data.start_date).toBe('2026-01-01')
    expect(result.data.end_date).toBe('2026-07-31')
  })

  it('aceita end_date null (o caso majoritário) e o conserva como null', () => {
    const result = ProtocolSchema.safeParse({
      medicine_id: 'med-1',
      start_date: '2026-01-01',
      end_date: null,
    })

    expect(result.success).toBe(true)
    if (result.success === false) return
    expect(result.data.end_date).toBeNull()
    expect(result.data.start_date).toBe('2026-01-01')
  })

  it('segue válido sem os campos de vigência (ambos opcionais)', () => {
    const result = ProtocolSchema.safeParse({ medicine_id: 'med-1' })

    expect(result.success).toBe(true)
    if (result.success === false) return
    expect(result.data.end_date).toBeUndefined()
  })
})
