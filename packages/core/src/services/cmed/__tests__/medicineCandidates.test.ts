import { describe, it, expect, afterEach, vi } from 'vitest'
import { classifySameMedicine, findMedicineCandidates } from '../medicineCandidates'
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

// 066 D2 · FR-027 (PO 2026-10-17): a caixa lida na compra é comparada ao remédio travado.
describe('classifySameMedicine', () => {
  it('genérico de outro laboratório, mesma dose/forma ⇒ identico', () => {
    expect(classifySameMedicine(clopidogrelEms, cadastroClopidogrel)).toBe('identico')
  })
  it('mesmo registro ANVISA ⇒ identico, mesmo com forma divergente', () => {
    const draft = { ...clopidogrelEms, anvisa_registration: '1004305170016', presentation: 'capsula' }
    expect(classifySameMedicine(draft, { ...cadastroClopidogrel, anvisa_registration: '1004305170016' })).toBe('identico')
  })
  it('cadastro antigo sem dose nem forma, mesmas substâncias e nome parecido ⇒ similar', () => {
    const antigo = { ...cadastroClopidogrel, dosage_per_pill: null, dosage_unit: null, presentation: null }
    expect(classifySameMedicine(clopidogrelEms, antigo)).toBe('similar')
  })
  it('mesma dose, forma diferente no cadastro ⇒ similar (não identico)', () => {
    expect(classifySameMedicine(clopidogrelEms, { ...cadastroClopidogrel, presentation: 'outro' })).toBe('similar')
  })
  it('marca cadastrada pelo nome da substância ⇒ similar', () => {
    const marca = { ...clopidogrelEms, name: 'Plavix' }
    expect(classifySameMedicine(marca, { ...cadastroClopidogrel, presentation: null })).toBe('similar')
  })
  it('dose conhecida dos dois lados e diferente ⇒ outro', () => {
    expect(classifySameMedicine({ ...clopidogrelEms, dosage_per_pill: 300 }, cadastroClopidogrel)).toBe('outro')
  })
  it('unidade conhecida dos dois lados e diferente ⇒ outro', () => {
    expect(classifySameMedicine({ ...clopidogrelEms, dosage_unit: 'mcg' }, cadastroClopidogrel)).toBe('outro')
  })
  it('substâncias diferentes, nome parecido ⇒ outro', () => {
    const combo = { ...clopidogrelEms, active_ingredient: 'Clopidogrel + Ácido Acetilsalicílico' }
    expect(classifySameMedicine(combo, { ...cadastroClopidogrel, presentation: null })).toBe('outro')
  })
  // 2026-10-18: era 'outro'; com cadastro sem substância, nome + dose/unidade iguais decidem (similar).
  it('substância vazia dos dois lados, mesmo nome e dose ⇒ similar; sem dose no cadastro ⇒ outro', () => {
    const semSub = { ...clopidogrelEms, active_ingredient: '' }
    expect(classifySameMedicine(semSub, { ...cadastroClopidogrel, active_ingredient: null, presentation: null })).toBe('similar')
    expect(classifySameMedicine(semSub, { ...cadastroClopidogrel, active_ingredient: null, dosage_per_pill: null })).toBe('outro')
  })
  it('mesmas substâncias, nomes sem termo em comum ⇒ outro', () => {
    const draft = { ...clopidogrelEms, name: 'Iscover' }
    const med = { ...cadastroClopidogrel, name: 'Plagrel', active_ingredient: 'Clopidogrel', presentation: null }
    expect(classifySameMedicine(draft, med)).toBe('outro')
  })
  it('remédio nulo ⇒ outro', () => {
    expect(classifySameMedicine(clopidogrelEms, null)).toBe('outro')
  })
  // 2026-10-18 (PO): 9% da base foi cadastrada à mão sem princípio ativo — sem isto a aba Estoque
  // ofereceria um cadastro duplicado.
  it('cadastro sem princípio ativo, nome parecido e mesma dose/unidade ⇒ similar', () => {
    expect(classifySameMedicine(clopidogrelEms, { ...cadastroClopidogrel, active_ingredient: null })).toBe('similar')
    expect(classifySameMedicine(clopidogrelEms, { ...cadastroClopidogrel, active_ingredient: '  ' })).toBe('similar')
  })
  it('cadastro sem princípio ativo e outra dose ⇒ outro', () => {
    expect(classifySameMedicine(clopidogrelEms, { ...cadastroClopidogrel, active_ingredient: null, dosage_per_pill: '300' })).toBe('outro')
  })
  it('cadastro sem princípio ativo e sem dose ⇒ outro (só o nome não basta)', () => {
    expect(classifySameMedicine(clopidogrelEms, { ...cadastroClopidogrel, active_ingredient: null, dosage_per_pill: null })).toBe('outro')
  })
  it('cadastro sem princípio ativo e nome sem termo em comum ⇒ outro', () => {
    expect(classifySameMedicine(clopidogrelEms, { ...cadastroClopidogrel, name: 'Plagrel', active_ingredient: null })).toBe('outro')
  })
})
