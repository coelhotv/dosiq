// archivedContext.test.ts — spec 094 PO-SEC-3 (FR-013 · RC-SEC S3)
//
// Medicamento/tratamento arquivado (excluído pela pessoa) não pode sair para o LLM: nem no
// catálogo, nem nos tratamentos, nem nas doses da janela. Hoje a propriedade vale por
// construção — o montador só lê medicamentos de tratamentos vigentes, e arquivado ⇒ inativo
// (INV-6, CHECK no banco) — e o fetch filtra `archived_at` na origem. Este teste é a GUARDA:
// se o montador passar a listar medicamento sem tratamento (ex.: catálogo completo), quebra aqui.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildPatientContext } from '../buildPatientContext'

const ACTIVE_MED = { id: 'med-on', name: 'Losartana', dosage_unit: 'mg', dosage_per_pill: 50, stock: [] }
const ARCHIVED_MED = {
  id: 'med-off', name: 'Fluoxetina', dosage_unit: 'mg', dosage_per_pill: 20, stock: [],
  archived_at: '2026-10-01T12:00:00Z',
}

const protocolOf = (id: string, medicineId: string, extra = {}) => ({
  id, medicine_id: medicineId, name: id, active: true, start_date: '2020-01-01', end_date: null,
  frequency: 'diário', weekdays: [], time_schedule: ['08:00'], dosage_per_intake: 1, intake_unit: null,
  ...extra,
})

describe('buildPatientContext — arquivado não sai para o LLM (094)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('contexto contém só o ativo; nome do arquivado ausente', () => {
    const ctx = buildPatientContext({
      medicines: [ACTIVE_MED, ARCHIVED_MED],
      protocols: [
        protocolOf('p-on', 'med-on'),
        // arquivado ⇒ active=false (INV-6); o filtro não pode depender disso
        protocolOf('p-off', 'med-off', { active: false, archived_at: '2026-10-01T12:00:00Z' }),
      ],
      logs: [{ protocol_id: 'p-off', taken_at: new Date().toISOString() }],
      stockSummary: [],
      doseInstances: [
        { id: 'di-off', protocol_id: 'p-off', medicine_id: 'med-off', scheduled_for: new Date().toISOString(), status: 'taken' },
      ],
    })
    const payload = JSON.stringify(ctx)
    expect(payload).toContain('Losartana')
    expect(payload).not.toContain('Fluoxetina')
  })

  it('tratamento arquivado de medicamento vivo também some', () => {
    const ctx = buildPatientContext({
      medicines: [ACTIVE_MED],
      protocols: [
        protocolOf('p-on', 'med-on', { name: 'Manhã' }),
        protocolOf('p-gone', 'med-on', { name: 'TratamentoExcluido', active: false, archived_at: '2026-10-01T12:00:00Z' }),
      ],
      logs: [],
      stockSummary: [],
      doseInstances: [],
    })
    expect(JSON.stringify(ctx)).not.toContain('TratamentoExcluido')
  })
})
