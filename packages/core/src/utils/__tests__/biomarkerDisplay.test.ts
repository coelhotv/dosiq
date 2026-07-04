import { describe, it, expect } from 'vitest'
import { formatBiomarkerDisplay, formatBiomarkerContext, biomarkerCardLabel } from '../biomarkerDisplay'

// Spec 032 — formatação composta PA + label de contexto robusto (ADR-070).

describe('formatBiomarkerDisplay', () => {
  it('PA → "S por D unit"', () => {
    expect(formatBiomarkerDisplay({ value: 120, value_secondary: 80, unit: 'mmHg' })).toBe('120 por 80 mmHg')
  })
  it('valor simples (sem value_secondary)', () => {
    expect(formatBiomarkerDisplay({ value: 110, unit: 'mg/dL' })).toBe('110 mg/dL')
  })
  it('value_secondary null → simples', () => {
    expect(formatBiomarkerDisplay({ value: 82.5, value_secondary: null, unit: 'kg' })).toBe('82,5 kg')
  })
  it('decimal vira vírgula PT-BR', () => {
    expect(formatBiomarkerDisplay({ value: 120.5, value_secondary: 80.5, unit: 'mmHg' })).toBe('120,5 por 80,5 mmHg')
  })
  it('item inválido → string vazia (sem crash)', () => {
    expect(formatBiomarkerDisplay(null)).toBe('')
    expect(formatBiomarkerDisplay({ unit: 'mmHg' })).toBe('')
  })
})

describe('formatBiomarkerContext', () => {
  it('contexto de glicemia', () => {
    expect(formatBiomarkerContext('jejum')).toBe('Jejum')
  })
  it('contexto de PA', () => {
    expect(formatBiomarkerContext('em_repouso')).toBe('Em repouso')
    expect(formatBiomarkerContext('pos_medicacao')).toBe('Após medicação')
  })
  it('desconhecido (DB livre pós-ADR-070) → null (oculta, sem crash)', () => {
    expect(formatBiomarkerContext('xyz')).toBeNull()
    expect(formatBiomarkerContext(null)).toBeNull()
    expect(formatBiomarkerContext(undefined)).toBeNull()
  })
})

describe('biomarkerCardLabel', () => {
  it('PA usa rótulo curto "Pressão"', () => {
    expect(biomarkerCardLabel('pressao_arterial')).toBe('Pressão')
  })
  it('demais tipos caem no rótulo completo', () => {
    expect(biomarkerCardLabel('glicemia')).toBe('Glicemia')
    expect(biomarkerCardLabel('peso')).toBe('Peso')
  })
  it('tipo desconhecido → o próprio valor', () => {
    expect(biomarkerCardLabel('xyz')).toBe('xyz')
  })
})
