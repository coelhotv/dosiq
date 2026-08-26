import { getAllTreatments } from '../treatmentsService'
import { supabase as supabaseImport } from '../../../../platform/supabase/nativeSupabaseClient'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseImport as any

/**
 * Contrato do SELECT de `getAllTreatments` (= `getActiveTreatments`).
 *
 * Motivo deste teste: o select é uma STRING — tsc, lint e os testes de comportamento
 * (que mockam o client) NÃO enxergam campo faltando. Um campo ausente chega como
 * `undefined` no consumidor e some em silêncio (AP-341 · R-267).
 *
 * Foi exatamente o que aconteceu com `presentation`: o embed não pedia a coluna, então
 * `isInjectable(protocol.medicine)` era SEMPRE false e o seletor de sítio de injeção
 * nunca aparecia no registro em lote (modos `plan`/`misc`/`active` via `usePlanProtocols`)
 * — e, pior, `_buildConfirmLogs` descartava o sítio no envio pelo mesmo gate.
 */
describe('treatmentsService — contrato do select (AP-341)', () => {
  let selects: string[] = []

  beforeEach(() => {
    selects = []
    // Cadeia fluente tolerante: qualquer método devolve o próprio proxy, e o proxy
    // resolve como { data: [], error: null } quando aguardado. Assim o serviço percorre
    // TODAS as queries (inclusive a das escadas de titulação) sem que o teste precise
    // conhecer a ordem dos operadores — o alvo aqui é a STRING do select, não o fluxo.
    const makeChain = (): any =>
      new Proxy(function () {} as any, {
        get(_t, prop) {
          if (prop === 'then') return (resolve: any) => resolve({ data: [], error: null })
          if (prop === 'select') return (s: string) => { selects.push(s); return makeChain() }
          return () => makeChain()
        },
        apply: () => makeChain(),
      })
    supabase.from = jest.fn(() => makeChain())
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  const medicineEmbedOf = (all: string[]) => {
    const sel = all.find((s) => s.includes('medicine:medicine_id')) ?? ''
    return sel.slice(sel.indexOf('medicine:medicine_id'))
  }

  it('pede `presentation` no embed de medicine — sem ela o gate de injetável morre', async () => {
    await getAllTreatments('11111111-1111-4111-8111-111111111111')
    expect(medicineEmbedOf(selects)).toContain('presentation')
  })

  it('mantém os demais campos de medicine que a UI consome', async () => {
    await getAllTreatments('11111111-1111-4111-8111-111111111111')
    const medicineEmbed = medicineEmbedOf(selects)
    for (const field of ['id', 'name', 'type', 'dosage_per_pill', 'dosage_unit', 'concentration_volume_ml', 'units_per_ml']) {
      expect(medicineEmbed).toContain(field)
    }
  })
})
