import { describe, it, expect, afterEach, vi } from 'vitest'
import { countTreatmentsInPeriod, resolveTreatmentCountBucket } from '../treatmentCountBucket'

// 092 FR-002 / PO-2. Datas SEMPRE como string local 'YYYY-MM-DD' (AP-270), nunca toISOString.
const TODAY = '2026-10-04'
const p = (over: Record<string, unknown> = {}) => ({ start_date: '2026-09-01', end_date: null, active: true, ...over })

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('countTreatmentsInPeriod', () => {
  it('pausado CONTA (persona = prescrição vigente, não agenda ativa)', () => {
    expect(countTreatmentsInPeriod([p({ active: false })], TODAY)).toBe(1)
  })

  it('active null conta', () => {
    expect(countTreatmentsInPeriod([p({ active: null })], TODAY)).toBe(1)
  })

  it('início futuro NÃO conta; início hoje conta', () => {
    expect(countTreatmentsInPeriod([p({ start_date: '2026-10-05' })], TODAY)).toBe(0)
    expect(countTreatmentsInPeriod([p({ start_date: TODAY })], TODAY)).toBe(1)
  })

  it('end_date inclusivo: vence hoje conta, venceu ontem não (AP-240)', () => {
    expect(countTreatmentsInPeriod([p({ end_date: TODAY })], TODAY)).toBe(1)
    expect(countTreatmentsInPeriod([p({ end_date: '2026-10-03' })], TODAY)).toBe(0)
  })

  it('semanal sem dose hoje conta (período, não agenda do dia)', () => {
    expect(countTreatmentsInPeriod([p({ frequency: 'semanal', weekdays: ['monday'] })], TODAY)).toBe(1)
  })

  it('lista vazia, não-array e itens nulos → 0', () => {
    expect(countTreatmentsInPeriod([], TODAY)).toBe(0)
    expect(countTreatmentsInPeriod(null as never, TODAY)).toBe(0)
    expect(countTreatmentsInPeriod([null, undefined] as never, TODAY)).toBe(0)
  })
})

describe('resolveTreatmentCountBucket', () => {
  const n = (k: number) => Array.from({ length: k }, () => p())

  it.each([
    [0, '0'],
    [1, '1-3'],
    [3, '1-3'],
    [4, '4+'],
    [9, '4+'],
  ])('%i tratamentos → %s', (k, bucket) => {
    expect(resolveTreatmentCountBucket(n(k), TODAY)).toBe(bucket)
  })

  it('corte 4+ casa com o limiar do adaptativo (> 3)', () => {
    expect(resolveTreatmentCountBucket([...n(3), p({ active: false })], TODAY)).toBe('4+')
  })
})
