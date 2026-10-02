import { describe, it, expect } from 'vitest'
import {
  validateBiomarkerLog,
  validateBiomarkerLogUpdate,
  BIOMARKER_TYPES,
  BIOMARKER_CONTEXTS,
  BIOMARKER_PA_CONTEXTS,
  BIOMARKER_TYPE_UNITS,
  BIOMARKER_PLAUSIBLE_RANGES,
} from '../index'

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
    expect(r.errors!.some((e) => e.field === 'context')).toBe(true)
  })
  it('glicemia + contexto PA → rejeitado', () => {
    const r = validateBiomarkerLog({ type: 'glicemia', value: 110, unit: 'mg/dL', context: 'em_repouso' })
    expect(r.success).toBe(false)
    expect(r.errors!.some((e) => e.field === 'context')).toBe(true)
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
    expect(r.data!.value).toBe(110)
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
    expect(r.data!.value).toBeCloseTo(110.5)
  })
})

describe('biomarkerLogSchema — PA / value_secondary (superRefine)', () => {
  it('PA exige value_secondary', () => {
    const r = validateBiomarkerLog({ type: 'pressao_arterial', value: 120, unit: 'mmHg' })
    expect(r.success).toBe(false)
    expect(r.errors!.some((e) => e.field === 'value_secondary')).toBe(true)
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

// 069 A2 (FR-017 · R-4 · S-4) — faixa de plausibilidade por tipo; tipo fora do mapa = só positive().
describe('biomarkerLogSchema — faixa plausível (BIOMARKER_PLAUSIBLE_RANGES)', () => {
  const peso = (value: unknown) => validateBiomarkerLog({ type: 'peso', value, unit: 'kg' })

  it('mapa só tem peso 20–200', () => {
    expect(BIOMARKER_PLAUSIBLE_RANGES).toEqual({ peso: { min: 20, max: 200 } })
  })
  it('peso 19,9 rejeitado com a copy da UI', () => {
    const r = peso(19.9)
    expect(r.success).toBe(false)
    expect(r.errors).toEqual([{ field: 'value', message: 'Use um valor entre 20 e 200 kg.' }])
  })
  it('peso 200,1 rejeitado', () => {
    expect(peso(200.1).success).toBe(false)
  })
  it('peso 20 e 200 aceitos (limites inclusivos)', () => {
    expect(peso(20).success).toBe(true)
    expect(peso(200).success).toBe(true)
  })
  it("peso '' segue barrado pelo positive (nunca vira 0)", () => {
    const r = peso('')
    expect(r.success).toBe(false)
  })
  it('glicemia 250 segue aceita (tipo fora do mapa)', () => {
    expect(validateBiomarkerLog({ type: 'glicemia', value: 250, unit: 'mg/dL' }).success).toBe(true)
  })
  it('update com type peso fora da faixa → rejeitado (G-3)', () => {
    expect(validateBiomarkerLogUpdate({ type: 'peso', value: 500 }).success).toBe(false)
  })
  it('update parcial sem type → só positive (inalterado)', () => {
    expect(validateBiomarkerLogUpdate({ value: 500 }).success).toBe(true)
  })
})
