// _treatmentsTransformer — contador das abas e lista agrupada contam a MESMA coisa (smoke 086:
// tratamento ativo com início futuro aparecia em "Ativos (1)" e sumia da lista).
import { transformTreatments } from '../_treatmentsTransformer'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

const base = { medicine: { name: 'Mesigyna' }, time_schedule: ['08:00'], frequency: 'diário', end_date: null }

function futureDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('transformTreatments', () => {
  it('ativo com início no futuro aparece na lista agrupada, não só no contador', () => {
    const future = { ...base, id: 'p-fut', active: true, frequency: 'intervalo_dias', interval_days: 30, start_date: futureDate(10) }
    const out = transformTreatments([future])
    expect(out.counts.ativos).toBe(1)
    const listed = out.groups.flatMap((g) => g.protocols.map((p) => p.id))
    expect(listed).toEqual(['p-fut'])
  })

  it('a lista agrupada tem exatamente os ativos do contador', () => {
    const rows = [
      { ...base, id: 'a', active: true, start_date: futureDate(-30) },
      { ...base, id: 'b', active: true, start_date: futureDate(5) },
      { ...base, id: 'c', active: false, start_date: futureDate(-30) },
      { ...base, id: 'd', active: true, start_date: futureDate(-90), end_date: futureDate(-1) },
    ]
    const out = transformTreatments(rows)
    const listed = out.groups.flatMap((g) => g.protocols.map((p) => p.id)).sort()
    expect(out.counts).toEqual({ ativos: 2, pausados: 1, finalizados: 1 })
    expect(listed).toEqual(['a', 'b'])
  })
})
