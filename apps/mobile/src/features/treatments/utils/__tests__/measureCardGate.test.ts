// measureCardGate.test.ts — spec 100 B · PO-7: glicemia 3 dias/7, PA 2 dias/7, dias LOCAIS distintos (AP-270).
import { describe, it, expect } from '@jest/globals'
import { distinctRecentDays, missingDaysForChart } from '../measureCardGate'

const NOW = new Date(2026, 9, 30, 10, 0) // sexta 30/10 10:00 local
const at = (d: number, h = 9, m = 9) => ({ measured_at: new Date(2026, m, d, h, 0).toISOString() })

describe('dias distintos na janela de 7 dias locais', () => {
  it('5 pontos no mesmo dia contam 1 dia (FM-B16)', () => {
    expect(distinctRecentDays([at(30, 7), at(30, 9), at(30, 12), at(30, 18), at(30, 22)], NOW)).toBe(1)
  })
  it('hoje-6 entra; hoje-7 fica fora (FM-B18)', () => {
    expect(distinctRecentDays([at(24)], NOW)).toBe(1)
    expect(distinctRecentDays([at(23)], NOW)).toBe(0)
  })
  it('23:50 e 00:10 são dias diferentes (hora local)', () => {
    expect(distinctRecentDays([at(28, 23), at(29, 0)], NOW)).toBe(2)
  })
  it('item sem measured_at é ignorado', () => {
    expect(distinctRecentDays([{ measured_at: null }, at(30)], NOW)).toBe(1)
  })
})

describe('mínimo por medida', () => {
  it('glicemia: 2 dias ⇒ falta 1; 3 dias ⇒ desenha', () => {
    expect(missingDaysForChart('glicemia', [at(28), at(29)], NOW)).toBe(1)
    expect(missingDaysForChart('glicemia', [at(28), at(29), at(30)], NOW)).toBe(0)
  })
  it('PA: 1 dia ⇒ falta 1; 2 dias ⇒ desenha', () => {
    expect(missingDaysForChart('pressao_arterial', [at(29)], NOW)).toBe(1)
    expect(missingDaysForChart('pressao_arterial', [at(29), at(30)], NOW)).toBe(0)
  })
  it('sem medida: glicemia faltam 3, PA faltam 2', () => {
    expect(missingDaysForChart('glicemia', [], NOW)).toBe(3)
    expect(missingDaysForChart('pressao_arterial', [], NOW)).toBe(2)
  })
})
