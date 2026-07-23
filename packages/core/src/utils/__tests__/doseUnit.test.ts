import { describe, it, expect } from 'vitest'
import {
  pluralizeDoseUnit,
  formatDoseUnit,
  formatDose,
  formatActiveIngredientHint,
  formatActiveIngredientFormula,
  formatActiveIngredientShort,
  formatMedicineFullName,
} from '../doseUnit'

describe('formatMedicineFullName', () => {
  // O caso que motivou o helper: numa escada de titulação todas as etapas têm o MESMO nome,
  // então "A próxima etapa usa Mounjaro" é verdade para todas e não identifica nada.
  it('distingue duas canetas do mesmo medicamento pela concentração', () => {
    const caneta25 = { name: 'Mounjaro', dosage_unit: 'mg/ml', dosage_per_pill: 5, concentration_volume_ml: 0.5 }
    const caneta5 = { name: 'Mounjaro', dosage_unit: 'mg/ml', dosage_per_pill: 10, concentration_volume_ml: 0.5 }
    const a = formatMedicineFullName(caneta25)
    const b = formatMedicineFullName(caneta5)
    expect(a).toBe('Mounjaro 2,5 mg / 0,5 mL')
    expect(b).toBe('Mounjaro 5 mg / 0,5 mL')
    expect(a).not.toBe(b)
  })

  it('sólido usa a concentração simples', () => {
    expect(
      formatMedicineFullName({ name: 'Selozok', dosage_unit: 'mg', dosage_per_pill: 25 })
    ).toBe('Selozok 25 mg')
  })

  it('sem concentração cadastrada devolve só o nome (nunca "Nome undefined")', () => {
    expect(formatMedicineFullName({ name: 'Vitamina D' })).toBe('Vitamina D')
    expect(formatMedicineFullName({ name: 'Vitamina D', dosage_per_pill: null })).toBe('Vitamina D')
  })

  it('medicamento ausente cai no fallback — o chamador escolhe o texto', () => {
    expect(formatMedicineFullName(null)).toBe('Medicamento')
    expect(formatMedicineFullName(undefined, 'dose atual')).toBe('dose atual')
    expect(formatMedicineFullName({ name: '   ' }, 'dose atual')).toBe('dose atual')
  })
})

describe('formatDose (unidade de tomada — líquidos 022)', () => {
  it('gotas: plural e singular', () => {
    expect(formatDose(15, 'gotas')).toBe('15 gotas')
    expect(formatDose(1, 'gotas')).toBe('1 gota')
  })
  it('ml: vírgula decimal PT-BR, grafia canônica mL', () => {
    expect(formatDose(2.5, 'ml')).toBe('2,5 mL')
    expect(formatDose(10, 'ml')).toBe('10 mL')
  })
  it('UI: escala direta', () => {
    expect(formatDose(10, 'UI')).toBe('10 UI')
  })
  it('milhar com ponto PT-BR', () => {
    expect(formatDose(3000, 'gotas')).toBe('3.000 gotas')
  })
  it('null/undefined → string vazia', () => {
    expect(formatDose(null, 'ml')).toBe('')
    expect(formatDose(undefined, 'gotas')).toBe('')
  })
  it('unidade desconhecida → valor + unidade sem crash', () => {
    expect(formatDose(5, 'xyz')).toBe('5 xyz')
    expect(formatDose(5, null)).toBe('5')
  })
  it('string com vírgula PT-BR no singular de gota (review #651)', () => {
    expect(formatDose('1,0', 'gotas')).toBe('1 gota')
    expect(formatDose('2,0', 'gotas')).toBe('2 gotas')
  })
})

describe('pluralizeDoseUnit (padronizado para unidade(s))', () => {
  it('singular quando qty === 1', () => {
    expect(pluralizeDoseUnit(1)).toBe('unidade')
    expect(pluralizeDoseUnit('1')).toBe('unidade')
  })

  it('plural quando qty !== 1', () => {
    expect(pluralizeDoseUnit(0)).toBe('unidades')
    expect(pluralizeDoseUnit(2)).toBe('unidades')
    expect(pluralizeDoseUnit(0.5)).toBe('unidades')
    expect(pluralizeDoseUnit(15)).toBe('unidades')
  })

  it('coerce string para number', () => {
    expect(pluralizeDoseUnit('1')).toBe('unidade')
    expect(pluralizeDoseUnit('2')).toBe('unidades')
    expect(pluralizeDoseUnit('0.5')).toBe('unidades')
  })

  it('fallback sem unidade-aware (decorrente da padronização)', () => {
    // Mesmo passando 2º argumento (legacy), ignora e retorna unidade(s)
    expect(pluralizeDoseUnit(1, 'mg')).toBe('unidade')
    expect(pluralizeDoseUnit(2, 'ml')).toBe('unidades')
  })
})

describe('formatDoseUnit', () => {
  it('formata inteiros', () => {
    expect(formatDoseUnit(1)).toBe('1 unidade')
    expect(formatDoseUnit(2)).toBe('2 unidades')
  })

  it('formata decimais com vírgula PT-BR', () => {
    expect(formatDoseUnit(0.5)).toBe('0,5 unidades')
    expect(formatDoseUnit(15.5)).toBe('15,5 unidades')
  })

  it('aceita string como qty', () => {
    expect(formatDoseUnit('1')).toBe('1 unidade')
    expect(formatDoseUnit('0.5')).toBe('0,5 unidades')
  })
})

describe('formatActiveIngredientShort', () => {
  it('retorna apenas a concentração formatada', () => {
    expect(formatActiveIngredientShort(2, 600, 'mg')).toBe('1.200 mg')
    expect(formatActiveIngredientShort(1.5, 100, 'ui')).toBe('150 UI')
    expect(formatActiveIngredientShort(3, 1, 'gotas')).toBe('')
  })

  it('escala automaticamente unidades metricas para >= 5.000', () => {
    // mcg -> mg
    expect(formatActiveIngredientShort(5, 1000, 'mcg')).toBe('5 mg')
    expect(formatActiveIngredientShort(10, 1000, 'mcg')).toBe('10 mg')
    // mg -> g
    expect(formatActiveIngredientShort(10, 500, 'mg')).toBe('5 g')
    expect(formatActiveIngredientShort(15, 500, 'mg')).toBe('7,5 g')
    // g -> kg
    expect(formatActiveIngredientShort(5, 1000, 'g')).toBe('5 kg')
    expect(formatActiveIngredientShort(8.5, 1000, 'g')).toBe('8,5 kg')
    // ml -> l
    expect(formatActiveIngredientShort(10, 500, 'ml')).toBe('5 l')
    expect(formatActiveIngredientShort(15, 500, 'ml')).toBe('7,5 l')
    // Sem conversão para unidades não-métricas e abaixo do threshold
    expect(formatActiveIngredientShort(10, 500, 'ui')).toBe('5.000 UI')
    expect(formatActiveIngredientShort(8, 500, 'mg')).toBe('4.000 mg')
  })

  it('trata decimais com vírgula PT-BR', () => {
    expect(formatActiveIngredientShort(0.5, 500, 'mg')).toBe('250 mg')
    expect(formatActiveIngredientShort(1.5, 1, 'gotas')).toBe('')
  })

  it('retorna string vazia para entradas inválidas', () => {
    expect(formatActiveIngredientShort(null, 100, 'ui')).toBe('')
    expect(formatActiveIngredientShort(2, null, 'ui')).toBe('')
    expect(formatActiveIngredientShort(2, 0, 'ui')).toBe('')
  })
})

describe('formatActiveIngredientHint', () => {
  it('formata inteiros com diferentes unidades em parenteses', () => {
    expect(formatActiveIngredientHint(2, 100, 'ui')).toBe('2 un. (200 UI)')
    expect(formatActiveIngredientHint(30, 500, 'mg')).toBe('30 un. (15 g)')
    expect(formatActiveIngredientHint(1, 10, 'ml')).toBe('1 un. (10 mL)')
    expect(formatActiveIngredientHint(3, 1, 'gotas')).toBe('3 gotas')
    expect(formatActiveIngredientHint(1, 1, 'un')).toBe('1 unidade')
  })

  it('formata decimais com vírgula PT-BR', () => {
    expect(formatActiveIngredientHint(1.5, 100, 'ui')).toBe('1,5 un. (150 UI)')
    expect(formatActiveIngredientHint(0.5, 500, 'mg')).toBe('0,5 un. (250 mg)')
    expect(formatActiveIngredientHint(1.5, 1, 'gotas')).toBe('1,5 gotas')
  })

  it('aceita string como qty', () => {
    expect(formatActiveIngredientHint('1.5', 100, 'ui')).toBe('1,5 un. (150 UI)')
  })

  it('retorna string vazia para entradas inválidas ou vazias', () => {
    expect(formatActiveIngredientHint(null, 100, 'ui')).toBe('')
    expect(formatActiveIngredientHint('', 100, 'ui')).toBe('')
    expect(formatActiveIngredientHint('abc', 100, 'ui')).toBe('')
    expect(formatActiveIngredientHint(2, null, 'ui')).toBe('2 UI')
  })
})

describe('formatActiveIngredientFormula', () => {
  it('formata com equivalência direta em texto limpo', () => {
    expect(formatActiveIngredientFormula(2, 100, 'ui')).toBe('Equivale a 200 UI')
    expect(formatActiveIngredientFormula(30, 500, 'mg')).toBe('Equivale a 15 g')
    expect(formatActiveIngredientFormula(1, 1, 'un')).toBe('Equivale a 1 unidade')
    expect(formatActiveIngredientFormula(3, 1, 'gotas')).toBe('Equivale a 3 gotas')
  })

  it('formata decimais com vírgula PT-BR', () => {
    expect(formatActiveIngredientFormula(1.5, 100, 'ui')).toBe('Equivale a 150 UI')
    expect(formatActiveIngredientFormula(0.5, 500, 'mg')).toBe('Equivale a 250 mg')
  })

  it('retorna string vazia para entradas inválidas ou vazias', () => {
    expect(formatActiveIngredientFormula(null, 100, 'ui')).toBe('')
    expect(formatActiveIngredientFormula('', 100, 'ui')).toBe('')
    expect(formatActiveIngredientFormula('abc', 100, 'ui')).toBe('')
  })
})


