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
})
