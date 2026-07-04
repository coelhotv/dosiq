import { describe, it, expect } from 'vitest'
import {
  INJECTION_SITES,
  INJECTION_SITE_VALUES,
  getInjectionSiteLabel,
  getInjectionSiteAbsorption,
  isInjectable,
} from '../injectionSites'

// Valores do CHECK SQL (migração 20260621_injection_site.sql). Paridade enum core ↔ DB.
const SQL_CHECK_VALUES = [
  'abdomen_e',
  'abdomen_d',
  'braco_e',
  'braco_d',
  'coxa_e',
  'coxa_d',
  'gluteo_e',
  'gluteo_d',
]

describe('injectionSites — paridade enum ↔ CHECK SQL (PO-7)', () => {
  it('INJECTION_SITE_VALUES casa exatamente com o CHECK SQL (mesmos valores, caixa exata)', () => {
    expect([...INJECTION_SITE_VALUES].sort()).toEqual([...SQL_CHECK_VALUES].sort())
  })

  it('tem 8 sítios, todos com value/label/absorption', () => {
    expect(INJECTION_SITES).toHaveLength(8)
    for (const s of INJECTION_SITES) {
      expect(s.value).toBeTruthy()
      expect(s.label).toBeTruthy()
      expect(s.absorption).toBeTruthy()
    }
  })
})

describe('getInjectionSiteLabel', () => {
  it('retorna label PT para sítio conhecido', () => {
    expect(getInjectionSiteLabel('coxa_d')).toBe('Coxa (direita)')
  })
  it('degrada no próprio valor para sítio desconhecido (não lança)', () => {
    expect(getInjectionSiteLabel('sitio_futuro')).toBe('sitio_futuro')
  })
  it('retorna null para vazio/null (campo oculto no histórico — PO-6)', () => {
    expect(getInjectionSiteLabel(null)).toBeNull()
    expect(getInjectionSiteLabel('')).toBeNull()
    expect(getInjectionSiteLabel(undefined)).toBeNull()
  })
})

describe('getInjectionSiteAbsorption (hint educacional, não-SaMD — PO-4)', () => {
  it('retorna hint para sítio conhecido', () => {
    expect(getInjectionSiteAbsorption('abdomen_e')).toMatch(/absor/i)
  })
  it('null para desconhecido/vazio', () => {
    expect(getInjectionSiteAbsorption('xyz')).toBeNull()
    expect(getInjectionSiteAbsorption(null)).toBeNull()
  })
})

describe('isInjectable — detecção por presentation (PO-1)', () => {
  it('true só quando presentation === injetavel', () => {
    expect(isInjectable({ presentation: 'injetavel' })).toBe(true)
  })
  it('false para oral/tópico/sem presentation/null', () => {
    expect(isInjectable({ presentation: 'comprimido' })).toBe(false)
    expect(isInjectable({ presentation: 'pomada' })).toBe(false)
    expect(isInjectable({ presentation: null })).toBe(false)
    expect(isInjectable({})).toBe(false)
    expect(isInjectable(null)).toBe(false)
    expect(isInjectable(undefined)).toBe(false)
  })
  it('NÃO confunde com type (type não tem injetavel)', () => {
    expect(isInjectable({ type: 'injetavel' })).toBe(false)
  })
})
