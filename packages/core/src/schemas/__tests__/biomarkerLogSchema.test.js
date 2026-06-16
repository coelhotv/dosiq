import { describe, it, expect } from 'vitest'
import {
  validateBiomarkerLog,
  validateBiomarkerLogUpdate,
  BIOMARKER_TYPES,
  BIOMARKER_CONTEXTS,
  BIOMARKER_PA_CONTEXTS,
  BIOMARKER_TYPE_UNITS,
} from '../index.js'

// 012 Fase C — biomarkerLogSchema (ADR-060). Enums PT, value_secondary (PA), failure modes.

describe('biomarkerLogSchema — enums', () => {
  it('tipos incluem glicemia/peso/pressao_arterial/batimentos', () => {
    expect(BIOMARKER_TYPES).toEqual(['glicemia', 'peso', 'pressao_arterial', 'batimentos'])
  })
  it('contextos de glicemia', () => {
    expect(BIOMARKER_CONTEXTS).toEqual(['jejum', 'pre_refeicao', 'pos_refeicao', 'ao_deitar', 'outro'])
  })
  it('contextos de PA (032)', () => {
    expect(BIOMARKER_PA_CONTEXTS).toEqual(['ao_acordar', 'em_repouso', 'ao_dormir', 'apos_exercicio', 'pos_medicacao'])
  })
})

// ADR-070 — context é domínio extensível; Zod valida união + refine cruza type↔família.
describe('biomarkerLogSchema — context por família (ADR-070)', () => {
  it('PA + contexto PA → aceito', () => {
    const r = validateBiomarkerLog({ type: 'pressao_arterial', value: 120, value_secondary: 80, unit: 'mmHg', context: 'em_repouso' })
    expect(r.success).toBe(true)
  })
  it('PA + contexto de glicemia → rejeitado', () => {
    const r = validateBiomarkerLog({ type: 'pressao_arterial', value: 120, value_secondary: 80, unit: 'mmHg', context: 'jejum' })
    expect(r.success).toBe(false)
    expect(r.errors.some((e) => e.field === 'context')).toBe(true)
  })
  it('glicemia + contexto PA → rejeitado', () => {
    const r = validateBiomarkerLog({ type: 'glicemia', value: 110, unit: 'mg/dL', context: 'em_repouso' })
    expect(r.success).toBe(false)
    expect(r.errors.some((e) => e.field === 'context')).toBe(true)
  })
  it('PA + contexto null → aceito (opcional)', () => {
    const r = validateBiomarkerLog({ type: 'pressao_arterial', value: 120, value_secondary: 80, unit: 'mmHg' })
    expect(r.success).toBe(true)
  })
})

describe('biomarkerLogSchema — happy path', () => {
  it('glicemia válida', () => {
    const r = validateBiomarkerLog({ type: 'glicemia', value: 110, unit: 'mg/dL', context: 'jejum' })
    expect(r.success).toBe(true)
    expect(r.data.value).toBe(110)
  })
  it('peso válido sem contexto', () => {
    const r = validateBiomarkerLog({ type: 'peso', value: 82.5, unit: BIOMARKER_TYPE_UNITS.peso })
    expect(r.success).toBe(true)
  })
})

describe('biomarkerLogSchema — failure modes', () => {
  it('value vazio → erro (preprocess "" → null, não 0)', () => {
    const r = validateBiomarkerLog({ type: 'glicemia', value: '', unit: 'mg/dL' })
    expect(r.success).toBe(false)
  })
  it('value 0 → erro (.positive)', () => {
    const r = validateBiomarkerLog({ type: 'glicemia', value: 0, unit: 'mg/dL' })
    expect(r.success).toBe(false)
  })
  it('vírgula PT-BR — string "110,5" coage (decimal-pad)', () => {
    const r = validateBiomarkerLog({ type: 'glicemia', value: '110.5', unit: 'mg/dL' })
    expect(r.success).toBe(true)
    expect(r.data.value).toBeCloseTo(110.5)
  })
})

describe('biomarkerLogSchema — PA / value_secondary (superRefine)', () => {
  it('PA exige value_secondary', () => {
    const r = validateBiomarkerLog({ type: 'pressao_arterial', value: 120, unit: 'mmHg' })
    expect(r.success).toBe(false)
    expect(r.errors.some((e) => e.field === 'value_secondary')).toBe(true)
  })
  it('PA com sistólica+diastólica válida', () => {
    const r = validateBiomarkerLog({ type: 'pressao_arterial', value: 120, value_secondary: 80, unit: 'mmHg' })
    expect(r.success).toBe(true)
  })
  it('glicemia com value_secondary → erro (só PA)', () => {
    const r = validateBiomarkerLog({ type: 'glicemia', value: 110, value_secondary: 70, unit: 'mg/dL' })
    expect(r.success).toBe(false)
  })
})

describe('biomarkerLogUpdate — parcial sem refine (R-274)', () => {
  it('patch só de value (sem type) valida', () => {
    const r = validateBiomarkerLogUpdate({ value: 99 })
    expect(r.success).toBe(true)
  })
})
