import { describe, it, expect, afterEach, vi } from 'vitest'
import fixture from './fixtures/cmed-fixture.json'
import { decodeCmedIndex, findRowsByProductName } from '../cmedIndex'
import type { CmedIndex, CmedRow } from '../cmedIndex'
import { medicineDraftFromRow, strengthChoicesFromDs } from '../cmedMedicine'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function decodeFixture(): CmedIndex {
  const result = decodeCmedIndex(structuredClone(fixture))
  if (result.ok === false) throw new Error(`fixture não decodifica: ${result.reason}`)
  return result.index
}

const index = decodeFixture()
const rowByName = (name: string): CmedRow => index.rows[findRowsByProductName(index, name)[0]]

describe('medicineDraftFromRow', () => {
  it('spec 100 PO-9: o rascunho carrega o código da classe junto da descrição', () => {
    const row = rowByName('Amoxicilina + Clavulanato de Potassio')
    expect(row.c).toBe('J1C1')
    const draft = medicineDraftFromRow(row)
    expect(draft.therapeutic_class_code).toBe('J1C1')
    expect(draft.therapeutic_class).toBe(row.cn)
  })

  it('spec 100 FM-3/FM-4: código ausente ou fora do formato vira null (cadastro nunca quebra no CHECK)', () => {
    const row = rowByName('Amoxicilina + Clavulanato de Potassio')
    expect(medicineDraftFromRow({ ...row, c: null }).therapeutic_class_code).toBeNull()
    expect(medicineDraftFromRow({ ...row, c: ' c7a ' }).therapeutic_class_code).toBe('C7A')
    expect(medicineDraftFromRow({ ...row, c: 'C02-X' }).therapeutic_class_code).toBeNull()
  })

  it('SC-005 / PO-2: amoxi+clav EMS genérico', () => {
    const draft = medicineDraftFromRow(rowByName('Amoxicilina + Clavulanato de Potassio'))
    expect(draft).toMatchObject({
      dosage_per_pill: 500,
      dosage_unit: 'mg',
      presentation: 'comprimido',
      boxQuantity: 21,
      displayLaboratory: 'EMS',
      regulatory_category: 'Genérico',
      strengthLabel: '500 mg + 125 mg',
      doseAmbiguous: false,
      isGeneric: true,
    })
  })

  it('D1: dose é o 1º número da apresentação, mesmo com SUBSTÂNCIA em ordem invertida', () => {
    const row = rowByName('Amoxicilina + Clavulanato de Potassio')
    expect(row.s.startsWith('Clavulanato')).toBe(true)
    expect(medicineDraftFromRow(row).dosage_per_pill).toBe(500)
  })

  it('PO-5: amb=1 deixa a dose em branco mesmo com d preenchido no arquivo', () => {
    const row = rowByName('Concor Anlo')
    expect(row.d).toBe(5)
    const draft = medicineDraftFromRow(row)
    expect(draft.dosage_per_pill).toBeNull()
    expect(draft.doseAmbiguous).toBe(true)
    expect(draft.strengthLabel).toBe('5 mg + 10 mg')
    expect(draft.anvisa_registration).toBe('100890321')
    expect(draft.strengthChoices).toEqual([{ dose: 5, unit: 'mg' }, { dose: 10, unit: 'mg' }])
  })

  it('C-C10: escolhas da força — 3 e 4 números, repetidos, unidades diferentes, decimais, irreconhecíveis', () => {
    expect(strengthChoicesFromDs('5 mg + 100 mg + 100 mg')).toEqual([{ dose: 5, unit: 'mg' }, { dose: 100, unit: 'mg' }])
    expect(strengthChoicesFromDs('125 mg + 50 mg + 300 mg + 30 mg')).toHaveLength(4)
    expect(strengthChoicesFromDs('5000 mcg + 100 mg + 100 mg')).toEqual([{ dose: 5000, unit: 'mcg' }, { dose: 100, unit: 'mg' }])
    expect(strengthChoicesFromDs('6 mg + 0.015 mg')).toEqual([{ dose: 6, unit: 'mg' }, { dose: 0.015, unit: 'mg' }])
    expect(strengthChoicesFromDs('12,5 mg + 50 mg')).toEqual([{ dose: 12.5, unit: 'mg' }, { dose: 50, unit: 'mg' }])
    expect(strengthChoicesFromDs('500 mg/')).toEqual([])
    expect(strengthChoicesFromDs('20 % + 0.5 % + 5 %')).toEqual([])
    expect(strengthChoicesFromDs(null)).toEqual([])
  })

  it('C-C10: sem ambiguidade não há escolhas', () => {
    expect(medicineDraftFromRow(rowByName('Clopidogrel')).strengthChoices).toEqual([])
  })

  it('D11: genérico sem registro nem laboratório persistido; exibe o laboratório', () => {
    const draft = medicineDraftFromRow(rowByName('Clopidogrel'))
    expect(draft.anvisa_registration).toBeNull()
    expect(draft.laboratory).toBeNull()
    expect(draft.displayLaboratory).toBe('EMS')
  })

  it('marca leva REGISTRO[:9] e laboratório', () => {
    const draft = medicineDraftFromRow(rowByName('Naridrin'))
    expect(draft.anvisa_registration).toBe('102350145')
    expect(draft.laboratory).toBe('EMS')
    expect(draft.regulatory_category).toBe('Novo')
    expect(draft.strengthLabel).toBe('1 mg/mL + 0,2 mg/mL + 5 mg/mL')
  })

  it('unidade nula: dose em branco e força exibida da caixa (mg/g)', () => {
    const draft = medicineDraftFromRow(rowByName('Adacne Perox'))
    expect(draft.dosage_unit).toBeNull()
    expect(draft.dosage_per_pill).toBeNull()
    expect(draft.strengthLabel).toBe('1 mg/g + 25 mg/g')
    expect(draft.presentation).toBe('pomada')
  })

  it('valores fora dos enums nunca lançam: forma ⇒ outro, unidade ⇒ null', () => {
    const base = rowByName('Clopidogrel')
    const draft = medicineDraftFromRow({ ...base, f: 'adesivo', u: 'meq/l', k: null, q: null, ds: null })
    expect(draft.presentation).toBe('outro')
    expect(draft.dosage_unit).toBeNull()
    expect(draft.dosage_per_pill).toBeNull()
    expect(draft.regulatory_category).toBeNull()
    expect(draft.boxQuantity).toBeNull()
    expect(draft.strengthLabel).toBeNull()
  })

  it('ds ausente usa a dose escalar; categoria desconhecida vira Outros', () => {
    const base = rowByName('Clopidogrel')
    const draft = medicineDraftFromRow({ ...base, ds: null, k: 'radiofarmaco' })
    expect(draft.strengthLabel).toBe('75 mg')
    expect(draft.regulatory_category).toBe('Outros')
  })

  // 066 D2 (C-10/C-11): embalagem lida do texto e forma contida, sobre a linha da fixture.
  it('injetável: volume, unidades e embalagem vêm do texto, não do q truncado', () => {
    const row = { ...rowByName('Clopidogrel'), f: 'injetavel', u: 'mg/ml', q: 1,
      a: '1,34 MG/ML SOL INJ CT X 1 CAR VD TRANS X 1,5 ML + 1 SIST APLIC PLAS' }
    expect(medicineDraftFromRow(row)).toMatchObject({ presentation: 'injetavel', boxQuantity: 1, boxVolumeMl: 1.5, boxUnits: 1, boxContainer: 'caneta' })
  })
  it('oral marcado injetável no índice vira líquido, sem embalagem de injetável', () => {
    const row = { ...rowByName('Clopidogrel'), f: 'injetavel', u: 'mg/ml', q: 150,
      a: '1 MG/ML SUS OR CT FR PLAS PET AMB X 150 ML + SER DOS' }
    expect(medicineDraftFromRow(row)).toMatchObject({ presentation: 'liquido', boxVolumeMl: 150, boxUnits: 1, boxContainer: null })
  })
  it('sólido: sem volume, unidades nem embalagem', () => {
    expect(medicineDraftFromRow(rowByName('Clopidogrel'))).toMatchObject({ boxVolumeMl: null, boxUnits: null, boxContainer: null })
  })
})

describe('volume do rótulo no rascunho (spec 113, FR-003 · INV-1/INV-2)', () => {
  const mounjaro = (over: Partial<CmedRow> = {}): CmedRow => ({
    ...rowByName('Clopidogrel'),
    p: 'Mounjaro',
    s: 'Tirzepatida',
    a: '5 MG/ML SOL INJ SC CT 2 SER PREENC VD TRANS X 0,5 ML + 2 CAN APLIC',
    f: 'injetavel',
    u: 'mg/ml',
    d: 5,
    ds: '5 mg/ml',
    amb: false,
    lv: 0.5,
    ...over,
  })

  it('Mounjaro (d 5, lv 0,5) ⇒ razão 5 + volume 0,5, rótulo da caixa', () => {
    const draft = medicineDraftFromRow(mounjaro())
    expect(draft.dosage_per_pill).toBe(5)
    expect(draft.concentration_volume_ml).toBe(0.5)
    expect(draft.strengthLabel).toBe('2,5 mg / 0,5 mL')
  })

  it('sem lv (Multidose) ⇒ idêntico a hoje, volume null', () => {
    const draft = medicineDraftFromRow(mounjaro({ lv: null, d: 4.17, ds: '4.17 mg/ml' }))
    expect(draft.dosage_per_pill).toBe(4.17)
    expect(draft.concentration_volume_ml).toBeNull()
    expect(draft.strengthLabel).toBe('4,17 mg/mL')
  })

  it('amb + lv ⇒ dose vazia e volume null (INV-2)', () => {
    const draft = medicineDraftFromRow(mounjaro({ amb: true }))
    expect(draft.dosage_per_pill).toBeNull()
    expect(draft.concentration_volume_ml).toBeNull()
  })

  it('unidade fora do enum + lv ⇒ volume null', () => {
    expect(medicineDraftFromRow(mounjaro({ u: 'meq/l' })).concentration_volume_ml).toBeNull()
  })
})
