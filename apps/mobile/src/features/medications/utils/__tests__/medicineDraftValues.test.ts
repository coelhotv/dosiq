// medicineDraftValues.test.ts — spec 100 B · FR-001: o código da classe sai da caixa e nunca sobra de outra escolha.
import { describe, it, expect } from '@jest/globals'
import { valuesFromDraft, baseFromScan } from '../medicineDraftValues'

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
