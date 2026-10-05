// formatMeasureSeriesA11y — texto alternativo do gráfico (069 Bb · FR-015 · PO-12 · INV-5).
import { describe, it, expect } from '@jest/globals'
import { formatMeasureSeriesA11y, formatShortDay, formatKg } from '../formatMeasureSeriesA11y'

const step = (over) => ({ index: 1, dose: '2,5 mg', start: '2026-08-01', end: null, clipped: false, meanKg: 89, count: 2, taken: 4, expected: 4, current: false, ...over })

const series = (kgs: number[]) => ({
  points: kgs.map((kg, i) => ({ day: `2026-08-0${i + 2}`, kg })),
  steps: [step({}), step({ index: 2, dose: '5 mg', meanKg: null, count: 0, taken: 1, expected: 2, current: true })],
  firstDay: '2026-08-02',
  lastDay: `2026-08-0${kgs.length + 1}`,
})

describe('formatMeasureSeriesA11y', () => {
  it('resumo completo do FR-015, inclusive etapas e etapa sem pesagem', () => {
    expect(formatMeasureSeriesA11y(series([90, 88.5, 87]))).toBe(
      'Gráfico de peso durante o tratamento. 3 pesagens entre 2 ago e 4 ago. Primeira pesagem: 90,0 quilos. ' +
        'Última pesagem: 87,0 quilos. Etapa 1, 2,5 mg: peso médio 89,0 quilos em 2 pesagens, 4 de 4 doses registradas. ' +
        'Etapa 2, 5 mg: sem pesagens, 1 de 2 doses registradas.'
    )
  })

  it('INV-5: perda e ganho usam o mesmo texto (sem perdeu/ganhou/diferença)', () => {
    const down = formatMeasureSeriesA11y(series([90, 88, 87]))
    const up = formatMeasureSeriesA11y(series([87, 88, 90]))
    for (const t of [down, up]) expect(t).not.toMatch(/perd|ganh|diferen|meta|previs/i)
    expect(down.replace(/[\d,]+ quilos/g, 'X')).toBe(up.replace(/[\d,]+ quilos/g, 'X'))
  })

  it('formatadores: dia local sem Date e kg com vírgula', () => {
    expect(formatShortDay('2026-12-31')).toBe('31 dez')
    expect(formatShortDay(null)).toBe('')
    expect(formatKg(82.46)).toBe('82,5')
  })
})
