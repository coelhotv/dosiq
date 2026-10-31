// trackedMeasureField.test.ts — spec 100 B · PO-6 (inferência só na edição, grava só no save) + PO-2 (escolha prevalece).
import { describe, it, expect } from '@jest/globals'
import { displayedTrackedMeasure, resolveTrackedMeasure, TRACKED_MEASURE_OPTIONS } from '../trackedMeasureField'
import { buildInitialValues } from '../../hooks/useProtocolFormState'

const INSULINA = { therapeutic_class_code: 'A10C5' }
const LOSARTANA = { therapeutic_class_code: 'C9A' }
const MOUNJARO = { therapeutic_class_code: 'A10S' }
const SEM_CODIGO = { therapeutic_class_code: null }

describe('pré-seleção (campo intocado = null no form)', () => {
  it('criar: nasce null — nada decidido antes do save', () => {
    expect(buildInitialValues({ todayIso: '2026-10-30', presetPlanId: null }).tracked_measure).toBeNull()
  })
  it('AC-1..AC-4: segue a matriz da classe; sem código cai no fallback da 069', () => {
    expect(displayedTrackedMeasure({ tracked_measure: null, frequency: 'diário' }, INSULINA)).toBe('glicemia')
    expect(displayedTrackedMeasure({ tracked_measure: null, frequency: 'diário' }, LOSARTANA)).toBe('pressao_arterial')
    expect(displayedTrackedMeasure({ tracked_measure: null, frequency: 'semanal' }, MOUNJARO)).toBe('peso')
    expect(displayedTrackedMeasure({ tracked_measure: null, frequency: 'semanal' }, SEM_CODIGO)).toBe('peso')
    expect(displayedTrackedMeasure({ tracked_measure: null, frequency: 'diário' }, SEM_CODIGO)).toBe('nenhum')
    expect(displayedTrackedMeasure({ tracked_measure: null, frequency: 'diário' }, null)).toBe('nenhum')
  })
  it('FM-B13: trocar de medicamento sem tocar no campo muda a pré-seleção', () => {
    const values = { tracked_measure: null, frequency: 'diário' }
    expect(displayedTrackedMeasure(values, INSULINA)).toBe('glicemia')
    expect(displayedTrackedMeasure(values, LOSARTANA)).toBe('pressao_arterial')
  })
  it("FM-B14 / AC-6: escolha gravada (inclusive 'nenhum') não muda com classe ou frequência", () => {
    expect(displayedTrackedMeasure({ tracked_measure: 'nenhum', frequency: 'diário' }, INSULINA)).toBe('nenhum')
    expect(displayedTrackedMeasure({ tracked_measure: 'glicemia', frequency: 'semanal' }, MOUNJARO)).toBe('glicemia')
  })
})

describe('save', () => {
  it("salvar sem tocar grava a inferência com origem 'inferred' (AC-1, AC-11)", () => {
    expect(resolveTrackedMeasure({ tracked_measure: null, frequency: 'diário' }, INSULINA)).toEqual({ value: 'glicemia', source: 'inferred' })
  })
  it("tocou ⇒ 'chosen'", () => {
    expect(resolveTrackedMeasure({ tracked_measure: 'peso', frequency: 'diário' }, INSULINA)).toEqual({ value: 'peso', source: 'chosen' })
  })
  it('opções = as 4 do CHECK do banco, na ordem do FR-004', () => {
    expect(TRACKED_MEASURE_OPTIONS.map((o) => o.value)).toEqual(['peso', 'glicemia', 'pressao_arterial', 'nenhum'])
  })
})
