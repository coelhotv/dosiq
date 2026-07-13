// formatStockDoses / doseToMl — spec 044 F4b.
//
// O hint do saldo inicial responde "quanto tempo de tratamento eu tenho na mão?" (doses),
// e não "quanto de princípio ativo há aí?" (que, no líquido, só repetia a concentração já
// exibida ao lado do nome).

import { describe, it, expect } from 'vitest'
import { formatStockDoses } from '../doseUnit'

const LOSARTANA = { dosage_unit: 'mg', dosage_per_pill: 50, presentation: 'comprimido' }
const MOUNJARO = {
  dosage_unit: 'mg/ml',
  dosage_per_pill: 5, // razão normalizada: 5 mg/ml (rótulo "2,5 mg / 0,5 mL")
  concentration_volume_ml: 0.5,
  presentation: 'injetavel',
}
const XAROPE = { dosage_unit: 'mg/ml', dosage_per_pill: 10, presentation: 'liquido' }
const INSULINA = { dosage_unit: 'ui/ml', units_per_ml: 100, presentation: 'injetavel' }

describe('formatStockDoses', () => {
  it('sólido: saldo ÷ unidades por tomada → doses', () => {
    // 24 comprimidos, 2 por tomada
    expect(formatStockDoses(24, LOSARTANA, { dosage_per_intake: 2 })).toBe('≈ 12 doses')
    expect(formatStockDoses(24, LOSARTANA, { dosage_per_intake: 1 })).toBe('≈ 24 doses')
  })

  it('injetável: conta APLICAÇÕES, convertendo a dose (mg) para ml', () => {
    // Caso do PO: 1,7 ml de Mounjaro, dose de 2,5 mg (= 0,5 ml) → 3 aplicações
    expect(formatStockDoses(1.7, MOUNJARO, { dosage_per_intake: 2.5, intake_unit: 'mg' })).toBe(
      '≈ 3 aplicações',
    )
  })

  it('líquido não injetável: conta DOSES', () => {
    expect(formatStockDoses(100, XAROPE, { dosage_per_intake: 15, intake_unit: 'ml' })).toBe(
      '≈ 6 doses',
    )
  })

  it('FLOOR sempre: meia dose não é dose disponível', () => {
    // 25 comprimidos, 2 por tomada = 12,5 → 12 (a 13ª tomada não existe na caixa)
    expect(formatStockDoses(25, LOSARTANA, { dosage_per_intake: 2 })).toBe('≈ 12 doses')
  })

  it('singular sem "s"', () => {
    expect(formatStockDoses(2, LOSARTANA, { dosage_per_intake: 2 })).toBe('≈ 1 dose')
    expect(formatStockDoses(0.5, MOUNJARO, { dosage_per_intake: 2.5, intake_unit: 'mg' })).toBe(
      '≈ 1 aplicação',
    )
  })

  it('saldo menor que uma dose → "≈ 0 doses" (informação honesta, não vazio)', () => {
    expect(formatStockDoses(1, LOSARTANA, { dosage_per_intake: 2 })).toBe('≈ 0 doses')
  })

  it('sem protocolo / sem dose por tomada → vazio (a UI cai no hint anterior)', () => {
    expect(formatStockDoses(24, LOSARTANA, null)).toBe('')
    expect(formatStockDoses(24, LOSARTANA, { dosage_per_intake: 0 })).toBe('')
    expect(formatStockDoses(24, LOSARTANA, { dosage_per_intake: null })).toBe('')
  })

  // `doseToMl` devolve a dose CRUA quando não consegue converter (não inventa conversão).
  // Confiar nisso cegamente contaria "2,5 mg" como se fossem 2,5 ml → aplicações fantasma.
  it('líquido sem concentração para converter a dose → vazio (nunca conta mg como ml)', () => {
    expect(
      formatStockDoses(10, { dosage_unit: 'mg/ml', dosage_per_pill: 0 }, { dosage_per_intake: 2.5, intake_unit: 'mg' }),
    ).toBe('')
  })

  it('saldo vazio/zero/inválido → vazio', () => {
    expect(formatStockDoses(0, LOSARTANA, { dosage_per_intake: 2 })).toBe('')
    expect(formatStockDoses('', LOSARTANA, { dosage_per_intake: 2 })).toBe('')
    expect(formatStockDoses('abc', LOSARTANA, { dosage_per_intake: 2 })).toBe('')
  })
})
