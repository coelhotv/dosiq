import { describe, it, expect, afterEach, vi } from 'vitest'
import { findMedicineCandidates } from '../medicineCandidates'
import type { CandidateDraftLike, CandidateMedicineLike } from '../medicineCandidates'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const clopidogrelEms: CandidateDraftLike = {
  name: 'Clopidogrel',
  active_ingredient: 'Bissulfato de Clopidogrel',
  dosage_per_pill: 75,
  dosage_unit: 'mg',
  presentation: 'comprimido',
  anvisa_registration: null,
}

const cadastroClopidogrel: CandidateMedicineLike = {
  id: 'm1',
  name: 'Clopidogrel',
  active_ingredient: 'Clopidogrel',
  dosage_per_pill: '75',
  dosage_unit: 'mg',
  presentation: 'comprimido',
}

describe('findMedicineCandidates', () => {
  it('PO-6: genérico de outro laboratório ⇒ identico (sal ignorado)', () => {
    expect(findMedicineCandidates(clopidogrelEms, [cadastroClopidogrel])).toEqual([
      { medicine: cadastroClopidogrel, match: 'identico' },
    ])
  })

  it('PO-6: mesma substância com dose diferente ⇒ nenhum candidato', () => {
    expect(findMedicineCandidates(clopidogrelEms, [{ ...cadastroClopidogrel, dosage_per_pill: 300 }])).toEqual([])
  })

  it('PO-6: nome editado pelo usuário + mesma dose/unidade ⇒ proximo', () => {
    const editado = { id: 'm2', name: 'Meu clopidogrel do coração', active_ingredient: null, dosage_per_pill: 75, dosage_unit: 'mg', presentation: null }
    expect(findMedicineCandidates(clopidogrelEms, [editado])).toEqual([{ medicine: editado, match: 'proximo' }])
  })

  it('PO-6: marca com mesmo registro ⇒ identico, mesmo com dose diferente', () => {
    const draft = { ...clopidogrelEms, name: 'Plavix', anvisa_registration: '123456789' }
    const plavix = { id: 'm3', name: 'Plavix', anvisa_registration: '123456789', dosage_per_pill: 300, dosage_unit: 'mg' }
    expect(findMedicineCandidates(draft, [plavix])).toEqual([{ medicine: plavix, match: 'identico' }])
  })

  it('amoxi+clav: ordem e hidrato diferentes entre fontes ainda casam identico', () => {
    const draft = {
      name: 'Amoxicilina + Clavulanato de Potassio',
      active_ingredient: 'Clavulanato de Potássio; Amoxicilina Tri-Hidratada',
      dosage_per_pill: 500,
      dosage_unit: 'mg',
      presentation: 'comprimido',
      anvisa_registration: null,
    }
    const med = { name: 'Clavulin', active_ingredient: 'Amoxicilina + Clavulanato De Potassio', dosage_per_pill: '500', dosage_unit: 'mg', presentation: 'comprimido' }
    expect(findMedicineCandidates(draft, [med])[0].match).toBe('identico')
  })

  it('unidade diferente ⇒ nenhum candidato', () => {
    expect(findMedicineCandidates(clopidogrelEms, [{ ...cadastroClopidogrel, dosage_unit: 'mcg' }])).toEqual([])
  })

  it('forma diferente rebaixa identico para proximo', () => {
    const capsula = { ...cadastroClopidogrel, presentation: 'capsula' }
    expect(findMedicineCandidates(clopidogrelEms, [capsula])).toEqual([{ medicine: capsula, match: 'proximo' }])
  })

  it('dose ambígua (null): só registro pode casar', () => {
    const draft = { ...clopidogrelEms, dosage_per_pill: null }
    expect(findMedicineCandidates(draft, [cadastroClopidogrel])).toEqual([])
  })

  it('dose do usuário com vírgula, nula ou inválida', () => {
    expect(findMedicineCandidates({ ...clopidogrelEms, dosage_per_pill: 0.5 }, [{ ...cadastroClopidogrel, dosage_per_pill: '0,5' }])).toHaveLength(1)
    expect(findMedicineCandidates(clopidogrelEms, [{ ...cadastroClopidogrel, dosage_per_pill: null }])).toEqual([])
    expect(findMedicineCandidates(clopidogrelEms, [{ ...cadastroClopidogrel, dosage_per_pill: 'abc' }])).toEqual([])
  })

  it('sem termo em comum ⇒ nada, mesmo com dose igual', () => {
    expect(findMedicineCandidates(clopidogrelEms, [{ name: 'Losartana', active_ingredient: 'Losartana Potássica', dosage_per_pill: 75, dosage_unit: 'mg' }])).toEqual([])
  })

  it('lista vazia ou nula ⇒ []; identicos antes de proximos', () => {
    expect(findMedicineCandidates(clopidogrelEms, [])).toEqual([])
    expect(findMedicineCandidates(clopidogrelEms, null)).toEqual([])
    const prox = { ...cadastroClopidogrel, id: 'p', presentation: 'capsula' }
    const result = findMedicineCandidates(clopidogrelEms, [prox, cadastroClopidogrel])
    expect(result.map((c) => c.match)).toEqual(['identico', 'proximo'])
  })
})
