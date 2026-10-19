import { classifyPurchaseScan, nextScanFields, purchaseScanFill, resolveStockScan } from '../purchaseScan'

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

// Rascunho como o scanner devolve: amoxicilina+clavulanato genérico EMS, X 21.
function draft(over: Record<string, unknown> = {}): any {
  return {
    name: 'Amoxicilina + Clavulanato de Potassio',
    active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
    dosage_per_pill: 500, dosage_unit: 'mg', presentation: 'comprimido',
    laboratory: null, anvisa_registration: '123456789', regulatory_category: 'Genérico', therapeutic_class: null,
    strengthLabel: '500 mg + 125 mg', displayLaboratory: 'EMS', boxQuantity: 21,
    boxVolumeMl: null, boxUnits: null, boxContainer: null,
    doseAmbiguous: false, strengthChoices: [], isGeneric: true, ...over,
  }
}

const travado = {
  id: 'm1', name: 'Amoxicilina + Clavulanato', active_ingredient: 'Amoxicilina; Clavulanato de Potássio',
  dosage_per_pill: 500, dosage_unit: 'mg', presentation: 'comprimido', anvisa_registration: '999999999',
}

describe('classifyPurchaseScan', () => {
  it('genérico de outro laboratório ⇒ identico', () => {
    expect(classifyPurchaseScan(draft(), travado)).toBe('identico')
  })
  it('cadastro antigo sem forma nem dose ⇒ similar', () => {
    expect(classifyPurchaseScan(draft(), { ...travado, presentation: null, dosage_per_pill: null })).toBe('similar')
  })
  it('dose ambígua: alguma concentração possível bate ⇒ identico', () => {
    const ambigua = draft({ dosage_per_pill: null, strengthChoices: [{ dose: 875, unit: 'mg' }, { dose: 500, unit: 'mg' }] })
    expect(classifyPurchaseScan(ambigua, travado)).toBe('identico')
  })
  it('outra força ⇒ outro', () => {
    expect(classifyPurchaseScan(draft({ dosage_per_pill: 875 }), travado)).toBe('outro')
  })
  it('outro remédio ⇒ outro', () => {
    expect(classifyPurchaseScan(draft({ name: 'Losartana', active_ingredient: 'Losartana Potássica' }), travado)).toBe('outro')
  })
  it('remédio ainda não carregado ⇒ outro', () => {
    expect(classifyPurchaseScan(draft(), null)).toBe('outro')
  })
})

describe('purchaseScanFill', () => {
  const opts = { labLocked: false, liquidInputs: false }
  it('sólido: sugere quantidade da caixa, laboratório e EAN', () => {
    expect(purchaseScanFill(draft(), '7896004703398', opts)).toEqual({ quantity: '21', laboratory: 'EMS', ean: '7896004703398' })
  })
  it('líquido: não sugere quantidade em comprimidos (X 240 é volume)', () => {
    expect(purchaseScanFill(draft({ presentation: 'liquido', boxQuantity: 240 }), '7896004703398', { ...opts, liquidInputs: true }).quantity).toBeUndefined()
  })
  it('remédio /ml: sugere nº de frascos e volume por frasco (vírgula pt-BR), sem embalagem no líquido', () => {
    const fill = purchaseScanFill(draft({ presentation: 'liquido', boxVolumeMl: 120, boxUnits: 1, boxContainer: null }), null, { ...opts, liquidInputs: true })
    expect(fill).toMatchObject({ bottles: '1', volume: '120' })
    expect(fill.container).toBeUndefined()
  })
  it('injetável: frascos, volume decimal e embalagem (Ozempic 1,5 mL caneta)', () => {
    const fill = purchaseScanFill(draft({ presentation: 'injetavel', boxVolumeMl: 1.5, boxUnits: 1, boxContainer: 'caneta' }), null, { ...opts, liquidInputs: true })
    expect(fill).toMatchObject({ bottles: '1', volume: '1,5', container: 'caneta' })
  })
  it('remédio /ml sem volume ou unidades lidos: não sugere (nunca chuta)', () => {
    const fill = purchaseScanFill(draft({ presentation: 'injetavel', boxVolumeMl: null, boxUnits: null, boxContainer: null }), null, { ...opts, liquidInputs: true })
    expect(fill.bottles).toBeUndefined()
    expect(fill.volume).toBeUndefined()
    expect(fill.container).toBeUndefined()
  })
  it('sólido: não sugere frascos nem volume', () => {
    const fill = purchaseScanFill(draft({ boxVolumeMl: null, boxUnits: null }), null, opts)
    expect(fill.bottles).toBeUndefined()
    expect(fill.volume).toBeUndefined()
  })
  it('injetável e embalagem desconhecida não sugerem quantidade', () => {
    expect(purchaseScanFill(draft({ presentation: 'injetavel' }), null, opts).quantity).toBeUndefined()
    expect(purchaseScanFill(draft({ boxQuantity: null }), null, opts).quantity).toBeUndefined()
    expect(purchaseScanFill(draft({ boxQuantity: 0 }), null, opts).quantity).toBeUndefined()
  })
  it('laboratório travado (marca) não é sobrescrito; caixa sem laboratório também não', () => {
    expect(purchaseScanFill(draft(), null, { ...opts, labLocked: true }).laboratory).toBeUndefined()
    expect(purchaseScanFill(draft({ displayLaboratory: null }), null, opts).laboratory).toBeUndefined()
  })
  it('EAN fora do formato vira null', () => {
    expect(purchaseScanFill(draft(), '78960', opts).ean).toBeNull()
    expect(purchaseScanFill(draft(), undefined, opts).ean).toBeNull()
  })
})

// 066 D2 · FR-030: "Ler a caixa" na aba Estoque acha o remédio entre os da conta.
describe('resolveStockScan', () => {
  const antigo = { ...travado, id: 'm2', presentation: null, dosage_per_pill: null }
  const losartana = { ...travado, id: 'm3', name: 'Losartana', active_ingredient: 'Losartana Potássica', dosage_per_pill: 50 }

  it('um idêntico (mesmo com similar junto) ⇒ abre a compra nele', () => {
    expect(resolveStockScan(draft(), [losartana, travado, antigo])).toEqual({ kind: 'one', medicine: travado })
  })
  it('dois idênticos ⇒ a pessoa escolhe', () => {
    const outro = { ...travado, id: 'm4' }
    const r = resolveStockScan(draft(), [travado, outro]) as any
    expect(r.kind).toBe('choose')
    expect(r.candidates.map((c: any) => c.medicine.id)).toEqual(['m1', 'm4'])
  })
  it('um similar só ⇒ abre a compra nele (a compra pergunta, C-16)', () => {
    expect(resolveStockScan(draft(), [antigo])).toEqual({ kind: 'one', medicine: antigo })
  })
  it('dois similares ⇒ a pessoa escolhe', () => {
    const antigo2 = { ...antigo, id: 'm5' }
    expect((resolveStockScan(draft(), [antigo, antigo2]) as any).kind).toBe('choose')
  })
  it('nenhum ⇒ não cadastrado; lista vazia ou nula idem', () => {
    expect(resolveStockScan(draft(), [losartana])).toEqual({ kind: 'none' })
    expect(resolveStockScan(draft(), [])).toEqual({ kind: 'none' })
    expect(resolveStockScan(draft(), null)).toEqual({ kind: 'none' })
  })
})

// C-12 (smoke 1.6): a leitura nova desfaz a anterior só onde a pessoa não mexeu.
describe('nextScanFields', () => {
  const vazio = { quantity: '', laboratory: '', ean: '', bottles: '', volume: '', container: '' }
  it('1ª leitura: aplica e guarda o valor de antes', () => {
    const r = nextScanFields({ ...vazio, laboratory: 'Lab do cadastro' }, { quantity: '21', laboratory: 'EMS', ean: '7896004703398' }, null)
    expect(r.changes).toEqual({ quantity: '21', laboratory: 'EMS', ean: '7896004703398' })
    expect(r.record?.before.laboratory).toBe('Lab do cadastro')
  })
  it('2ª leitura de outro remédio: devolve o valor de antes (inclusive o laboratório que já existia)', () => {
    const first = nextScanFields({ ...vazio, laboratory: 'Lab do cadastro' }, { quantity: '21', laboratory: 'EMS', ean: '7896004703398' }, null)
    const filled = { ...vazio, quantity: '21', laboratory: 'EMS', ean: '7896004703398' }
    const r = nextScanFields(filled, null, first.record)
    expect(r.changes).toEqual({ quantity: '', laboratory: 'Lab do cadastro', ean: '' })
    expect(r.record).toBeNull()
  })
  it('campo editado pela pessoa depois da leitura fica', () => {
    const first = nextScanFields(vazio, { quantity: '21', laboratory: 'EMS', ean: '7896004703398' }, null)
    const r = nextScanFields({ ...vazio, quantity: '42', laboratory: 'EMS', ean: '7896004703398' }, null, first.record)
    expect(r.changes).toEqual({ laboratory: '', ean: '' })
  })
  it('remédio /ml: frascos, volume e embalagem também são desfeitos e trocados', () => {
    const first = nextScanFields(vazio, { ean: null, bottles: '1', volume: '1,5', container: 'caneta' }, null)
    const r = nextScanFields({ ...vazio, bottles: '1', volume: '1,5', container: 'caneta' }, { ean: null, bottles: '4', volume: '0,5', container: 'frasco_ampola' }, first.record)
    expect(r.changes).toEqual({ bottles: '4', volume: '0,5', container: 'frasco_ampola' })
  })
})
