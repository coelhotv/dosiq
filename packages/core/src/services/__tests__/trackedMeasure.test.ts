// trackedMeasure (spec 100 · PO-1): matriz FR-002 linha a linha + fallback + medida efetiva.
// Códigos reais do índice CMED v1.1.19 (2026-10-18), não inventados.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BIOMARKER_TYPES } from '../../schemas/biomarkerLogSchema'
import { TRACKED_MEASURES } from '../../schemas/protocolSchema'
import {
  MEASURE_CLASS_MATRIX,
  effectiveMeasure,
  inferMeasure,
  normalizeClassCode,
} from '../trackedMeasure'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const daily = (classCode: string | null) => inferMeasure({ classCode, frequency: 'diário' })

describe('inferMeasure — cada prefixo da matriz (FR-002)', () => {
  it.each([
    // A10 → glicemia (insulinas, sulfonilureias, metformina, DPP-4, SGLT2)
    ['A10C1', 'glicemia'],
    ['A10C5', 'glicemia'],
    ['A10H', 'glicemia'],
    ['A10J1', 'glicemia'],
    ['A10N1', 'glicemia'],
    ['A10P3', 'glicemia'],
    // GLP-1/antiobesidade → peso (D-3)
    ['A8A', 'peso'],
    ['A10S', 'peso'],
    ['A10X9', 'peso'],
    // anti-hipertensivos → pressão
    ['C2A1', 'pressao_arterial'],
    ['C3A1', 'pressao_arterial'],
    ['C7A0', 'pressao_arterial'],
    ['C8A', 'pressao_arterial'],
    ['C9C', 'pressao_arterial'],
  ] as const)('%s → %s', (code, expected) => {
    expect(daily(code)).toBe(expected)
  })

  it('toda linha da matriz tem caso acima (nenhum prefixo sem teste)', () => {
    const covered = ['A10C1', 'A8A', 'A10S', 'A10X9', 'C2A1', 'C3A1', 'C7A0', 'C8A', 'C9C']
    for (const [prefix] of MEASURE_CLASS_MATRIX) {
      expect(covered.some((code) => code.startsWith(prefix))).toBe(true)
    }
  })

  it('FM-9: prefixo mais longo vence, independente da ordem da matriz', () => {
    expect(daily('A10S')).toBe('peso')
    expect(daily('A10X9')).toBe('peso')
    // A10X1 (hipotético) não é A10X9 ⇒ cai em A10
    expect(daily('A10X1')).toBe('glicemia')
  })

  it('C1/C10/C11 (cardíacos, lipídios) não colidem com C2..C9', () => {
    for (const code of ['C1A1', 'C1X', 'C10A1', 'C10B', 'C11A1']) expect(daily(code)).toBe('nenhum')
  })

  it('GLP-1 semanal continua peso; insulina semanal (incomum) é glicemia — a classe vence o fallback', () => {
    expect(inferMeasure({ classCode: 'A10S', frequency: 'semanal' })).toBe('peso')
    expect(inferMeasure({ classCode: 'A10C5', frequency: 'semanal' })).toBe('glicemia')
  })
})

describe('inferMeasure — fallback da 069 (FM-7, FM-8)', () => {
  it.each([null, '', '   ', 'J1C1', 'N3A', 'c02', 'C02-X'])('sem código/fora da matriz %j: semanal → peso', (code) => {
    expect(inferMeasure({ classCode: code, frequency: 'semanal' })).toBe('peso')
  })

  it.each(['diário', 'dias_alternados', 'intervalo_dias', 'personalizado', 'quando_necessário', null, undefined])(
    'sem código, frequência %j não semanal → nenhum',
    (frequency) => {
      expect(inferMeasure({ classCode: null, frequency })).toBe('nenhum')
    },
  )

  it('FM-10: código com espaço/minúsculo é normalizado antes do match', () => {
    expect(daily(' a10c5 ')).toBe('glicemia')
  })
})

describe('normalizeClassCode', () => {
  it('normaliza e rejeita fora do formato do CHECK', () => {
    expect(normalizeClassCode(' c7a ')).toBe('C7A')
    expect(normalizeClassCode(undefined)).toBeNull()
    expect(normalizeClassCode('C')).toBeNull()
    expect(normalizeClassCode('A10X9Z9')).toBeNull()
    expect(normalizeClassCode('7A')).toBeNull()
  })
})

describe('effectiveMeasure — três estados + chave ausente (ADR-121 §4, FM-11/FM-12)', () => {
  it('NULL = não decidido ⇒ regra da 069', () => {
    expect(effectiveMeasure({ frequency: 'semanal', tracked_measure: null })).toBe('peso')
    expect(effectiveMeasure({ frequency: 'diário', tracked_measure: null })).toBe('nenhum')
  })

  it("escolha gravada prevalece, inclusive 'nenhum' num semanal (INV-1)", () => {
    expect(effectiveMeasure({ frequency: 'semanal', tracked_measure: 'nenhum' })).toBe('nenhum')
    expect(effectiveMeasure({ frequency: 'semanal', tracked_measure: 'glicemia' })).toBe('glicemia')
    expect(effectiveMeasure({ frequency: 'diário', tracked_measure: 'pressao_arterial' })).toBe('pressao_arterial')
  })

  it('chave ausente NÃO vira fallback (select incompleto falha fechado)', () => {
    expect(effectiveMeasure({ frequency: 'semanal' })).toEqual({ missing: true })
    expect(effectiveMeasure({ frequency: 'semanal', tracked_measure: undefined })).toEqual({ missing: true })
  })

  it('valor fora do enum ⇒ missing', () => {
    expect(effectiveMeasure({ frequency: 'semanal', tracked_measure: 'Peso' })).toEqual({ missing: true })
    expect(effectiveMeasure({ frequency: 'semanal', tracked_measure: 7 })).toEqual({ missing: true })
  })
})

describe('enum × tipos de biomarcador (E-7: biomarkers_log.type não tem CHECK)', () => {
  it('toda medida acompanhada é um tipo de biomarcador, mais nenhum', () => {
    for (const measure of TRACKED_MEASURES) {
      if (measure !== 'nenhum') expect(BIOMARKER_TYPES).toContain(measure)
    }
  })
})
