import { describe, it, expect } from 'vitest'
import { getMedicineIconName } from '../medicineIcon'

// 012 Fase A — fonte única do ícone (decisão PO 2026-06-10)
describe('getMedicineIconName', () => {
  it('suplemento ganha de presentation (categoria > forma)', () => {
    expect(getMedicineIconName({ type: 'suplemento', presentation: 'capsula' })).toBe('pill-bottle')
  })

  it('mapeia cada presentation', () => {
    expect(getMedicineIconName({ presentation: 'capsula' })).toBe('pill')
    expect(getMedicineIconName({ presentation: 'comprimido' })).toBe('tablets')
    expect(getMedicineIconName({ presentation: 'liquido' })).toBe('droplets')
    expect(getMedicineIconName({ presentation: 'injetavel' })).toBe('syringe')
    expect(getMedicineIconName({ presentation: 'pomada' })).toBe('soap-dispenser-droplet')
    expect(getMedicineIconName({ presentation: 'spray' })).toBe('spray-can')
  })

  it("presentation 'outro'/desconhecida → fallback pill", () => {
    expect(getMedicineIconName({ presentation: 'outro' })).toBe('pill')
    expect(getMedicineIconName({ presentation: 'xyz' })).toBe('pill')
  })

  it('legado sem presentation: /ml → droplets (decisão-mãe 022)', () => {
    expect(getMedicineIconName({ dosage_unit: 'mg/ml' })).toBe('droplets')
    expect(getMedicineIconName({ dosage_unit: 'ui/ml' })).toBe('droplets')
  })

  it('degenerados: null/undefined/vazio → pill', () => {
    expect(getMedicineIconName(null)).toBe('pill')
    expect(getMedicineIconName({})).toBe('pill')
    expect(getMedicineIconName({ dosage_unit: 'mg' })).toBe('pill')
  })
})
