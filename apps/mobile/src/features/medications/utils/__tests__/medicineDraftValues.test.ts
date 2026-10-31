// medicineDraftValues.test.ts — spec 100 B · FR-001: o código da classe sai da caixa e nunca sobra de outra escolha.
import { describe, it, expect } from '@jest/globals'
import {
  valuesFromDraft,
  baseFromScan,
  scanDoseEdited,
  normalizeConcentration,
  withNormalizedConcentration,
} from '../medicineDraftValues'

const DRAFT = {
  name: 'Lantus', active_ingredient: 'insulina glargina', therapeutic_class: 'INSULINAS HUMANAS E ANÁLOGOS',
  therapeutic_class_code: 'A10C5', regulatory_category: 'Biológico', laboratory: 'Sanofi', anvisa_registration: '1',
  dosage_per_pill: 100, dosage_unit: 'ui/ml', presentation: 'injetavel', strengthLabel: null,
}

describe('therapeutic_class_code', () => {
  it('caixa escolhida pela busca leva o código do rascunho', () => {
    expect(valuesFromDraft({ therapeutic_class_code: null }, DRAFT, {}).therapeutic_class_code).toBe('A10C5')
  })
  it('caixa lida pelo scan leva o código', () => {
    const v = valuesFromDraft(baseFromScan(DRAFT, {}), DRAFT, {})
    expect(v.therapeutic_class_code).toBe('A10C5')
  })
  it('caixa sem código ⇒ null, nunca o código anterior (C-B3: setValues faz merge)', () => {
    const previous = { therapeutic_class_code: 'C9A' }
    expect(valuesFromDraft(previous, { ...DRAFT, therapeutic_class_code: null }, previous).therapeutic_class_code).toBeNull()
    expect(baseFromScan({ ...DRAFT, therapeutic_class_code: undefined }, previous).therapeutic_class_code).toBeNull()
  })
})

describe('spec 113 — volume do rótulo (FR-005 · FR-006b · INV-1)', () => {
  const MOUNJARO = {
    ...DRAFT, name: 'Mounjaro', therapeutic_class_code: null, dosage_per_pill: 5, dosage_unit: 'mg/ml',
    concentration_volume_ml: 0.5, strengthLabel: '2,5 mg / 0,5 mL',
  }

  it('rascunho (razão 5, vol 0,5) ⇒ form com o valor da caixa 2,5 + volume 0,5', () => {
    const v = valuesFromDraft({}, MOUNJARO, {})
    expect(v.dosage_per_pill).toBe('2.5')
    expect(v.concentration_volume_ml).toBe('0.5')
  })

  it('sem volume ⇒ idêntico a hoje e limpa volume de escolha anterior (merge C-B3)', () => {
    const v = valuesFromDraft({ concentration_volume_ml: '0.5' }, { ...MOUNJARO, dosage_per_pill: 4.17, concentration_volume_ml: null }, {})
    expect(v.dosage_per_pill).toBe('4.17')
    expect(v.concentration_volume_ml).toBe('')
  })

  it('dose ambígua ⇒ campo vazio (INV-2)', () => {
    expect(valuesFromDraft({}, { ...MOUNJARO, dosage_per_pill: null, concentration_volume_ml: null }, {}).dosage_per_pill).toBe('')
  })

  it('salvar o form do Mounjaro grava a razão 5 + volume 0,5 (nunca 2,5)', () => {
    const form = valuesFromDraft({}, MOUNJARO, {})
    expect(normalizeConcentration(form)).toEqual({ dosage_per_pill: 5, concentration_volume_ml: 0.5 })
  })

  it('normalizeConcentration: dose vazia mantém o volume (como o form antigo); vazio/1/não líquido/inválido', () => {
    expect(normalizeConcentration({ dosage_per_pill: '', dosage_unit: 'mg/ml', concentration_volume_ml: '0.5' })).toEqual({ dosage_per_pill: null, concentration_volume_ml: 0.5 })
    expect(normalizeConcentration({ dosage_per_pill: '5', dosage_unit: 'mg/ml', concentration_volume_ml: '1' })).toEqual({ dosage_per_pill: 5, concentration_volume_ml: null })
    expect(normalizeConcentration({ dosage_per_pill: '5', dosage_unit: 'mg/ml', concentration_volume_ml: '' })).toEqual({ dosage_per_pill: 5, concentration_volume_ml: null })
    expect(normalizeConcentration({ dosage_per_pill: '5', dosage_unit: 'mg/ml', concentration_volume_ml: '0' })).toEqual({ dosage_per_pill: 5, concentration_volume_ml: null })
    expect(normalizeConcentration({ dosage_per_pill: '500', dosage_unit: 'mg', concentration_volume_ml: '0.5' })).toEqual({ dosage_per_pill: 500, concentration_volume_ml: null })
    expect(normalizeConcentration({ dosage_per_pill: '2,5', dosage_unit: 'mg/ml', concentration_volume_ml: '0,5' })).toEqual({ dosage_per_pill: 5, concentration_volume_ml: 0.5 })
  })

  it('withNormalizedConcentration: sem volume devolve o MESMO objeto; volume órfão de unidade sólida é limpo', () => {
    const plain = { name: 'Losartana', dosage_per_pill: '50', dosage_unit: 'mg' }
    expect(withNormalizedConcentration(plain)).toBe(plain)
    expect(withNormalizedConcentration({ ...plain, concentration_volume_ml: '0.5' })).toMatchObject({ dosage_per_pill: 50, concentration_volume_ml: null })
    expect(withNormalizedConcentration({ dosage_per_pill: '2.5', dosage_unit: 'mg/ml', concentration_volume_ml: '0.5' })).toMatchObject({ dosage_per_pill: 5, concentration_volume_ml: 0.5 })
  })

  it('scanDoseEdited: aceitar o preenchimento do Mounjaro ⇒ false; mexer na dose ou no volume ⇒ true', () => {
    const form = valuesFromDraft({}, MOUNJARO, {})
    expect(scanDoseEdited(form, MOUNJARO)).toBe(false)
    expect(scanDoseEdited({ ...form, dosage_per_pill: '5' }, MOUNJARO)).toBe(true)
    expect(scanDoseEdited({ ...form, concentration_volume_ml: '' }, MOUNJARO)).toBe(true)
    const semVol = { ...DRAFT, dosage_per_pill: 50, dosage_unit: 'mg', concentration_volume_ml: null }
    expect(scanDoseEdited(valuesFromDraft({}, semVol, {}), semVol)).toBe(false)
  })
})
