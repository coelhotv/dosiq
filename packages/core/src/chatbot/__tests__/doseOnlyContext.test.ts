// doseOnlyContext.test.ts — spec 044 T006 (CON-028 aditivo)
//
// Em modo dose-only o contexto do chatbot NÃO pode mencionar estoque — nem saldo, nem
// "SEM ESTOQUE", nem "repor". O risco real é o FALLBACK: o builder soma os lotes embedded
// em `medicine.stock[]` quando o stockSummary vem vazio → saldo 0 → "SEM ESTOQUE" fantasma.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildPatientContext } from '../buildPatientContext'

const MED = {
  id: 'med-1',
  name: 'Ozempic',
  dosage_unit: 'mg',
  dosage_per_pill: 1,
  stock: [{ quantity: 0 }], // saldo zerado — o gatilho do "SEM ESTOQUE" fantasma
}

const PROTOCOL = {
  id: 'prot-1',
  medicine_id: 'med-1',
  active: true,
  start_date: '2020-01-01',
  end_date: null,
  frequency: 'semanal',
  weekdays: ['segunda'],
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  intake_unit: 'mg',
}

const base = { medicines: [MED], protocols: [PROTOCOL], logs: [], stockSummary: [], doseInstances: [] }

describe('buildPatientContext — dose-only (044)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('dose-only: nenhuma menção a estoque no contexto', () => {
    const ctx = buildPatientContext({ ...base, stockTrackingEnabled: false })

    expect(ctx).not.toMatch(/estoque/i)
    expect(ctx).not.toMatch(/SEM ESTOQUE/)
    expect(ctx).not.toMatch(/repor/i)
    // O medicamento continua no contexto (o que muda é só o bloco de estoque).
    expect(ctx).toContain('Ozempic')
  })

  it('GUARD: tracking on (default) mantém o bloco de estoque — FR-009', () => {
    const ctx = buildPatientContext(base)
    expect(ctx).toMatch(/estoque/i)
  })

  it('GUARD: consumidor legado que não passa o flag continua com estoque (aditivo)', () => {
    const ctx = buildPatientContext({ ...base, stockTrackingEnabled: undefined as any })
    expect(ctx).toMatch(/estoque/i)
  })
})
