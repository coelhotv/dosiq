import { describe, it, expect, afterEach, vi } from 'vitest'
import { computeAdherenceFromInstances } from '../adherenceLogic'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

/**
 * Teste de paridade JS ↔ SQL (trava de schema drift — lição Sprint 7 / ADR-054).
 *
 * As views `v_daily_adherence`/`v_adherence_heatmap` (S4.2b) e o core
 * `computeAdherenceFromInstances` DEVEM produzir o MESMO número a partir do mesmo
 * conjunto de `dose_instances`. Aqui replicamos a fórmula SQL em JS e exigimos
 * igualdade. Se a fórmula divergir num lado, o relatório (PDF/views) volta a
 * descasar do anel do dashboard — este teste falha antes disso chegar à UI.
 *
 * Fórmula SQL (idêntica nas duas views):
 *   expected = count(status IN ('taken','missed'))
 *   taken    = count(status = 'taken')
 *   adherence_percentage = CASE WHEN expected=0 THEN NULL
 *     ELSE GREATEST(0, LEAST(100, round(taken/expected*100, 2))) END
 * skipped_* e pending ficam fora do denominador (R-248).
 */
function sqlAdherenceFormula(instances) {
  const considered = instances.filter((i) => i.status === 'taken' || i.status === 'missed')
  const expected = considered.length
  const taken = considered.filter((i) => i.status === 'taken').length
  if (expected === 0) return null
  const pct = Math.round((taken / expected) * 100 * 100) / 100 // round(…, 2)
  return Math.max(0, Math.min(100, pct))
}

const cases = [
  { name: 'todos taken', set: [{ status: 'taken' }, { status: 'taken' }] },
  { name: 'misto taken/missed', set: [{ status: 'taken' }, { status: 'taken' }, { status: 'missed' }] },
  { name: 'todos missed', set: [{ status: 'missed' }, { status: 'missed' }] },
  {
    name: 'skipped/pending neutros (fora do denominador)',
    set: [{ status: 'taken' }, { status: 'missed' }, { status: 'skipped_paused' }, { status: 'skipped_user' }, { status: 'pending' }],
  },
  { name: 'apenas skipped/pending → denom vazio', set: [{ status: 'skipped_user' }, { status: 'pending' }] },
  { name: 'vazio', set: [] },
]

describe('Paridade adesão JS core ↔ fórmula SQL (ADR-054 / R-248)', () => {
  cases.forEach(({ name, set }) => {
    it(`bate em: ${name}`, () => {
      const agg = computeAdherenceFromInstances(set)
      const sqlPct = sqlAdherenceFormula(set)

      if (sqlPct === null) {
        // denom vazio → SQL retorna NULL; core retorna rate null (denom vazio→null, R-248)
        expect(agg.rate == null).toBe(true)
      } else {
        const jsPct = Math.max(0, Math.min(100, Math.round((agg.rate ?? 0) * 100 * 100) / 100))
        expect(jsPct).toBe(sqlPct)
      }
    })
  })
})
