// weightChartLayout.ts — medidas do gráfico de peso por etapa (spec 069 Bb · FR-013 · DESIGN §3.2).
// Fora do componente para o skeleton do card (B-4) reproduzir a geometria do B-0 (react-refresh).

export const WEIGHT_CHART_H = 180
/** Abaixo disto o rótulo da faixa vira só o número; abaixo de BAND_HIDE_PX some (DESIGN §3.2). */
export const BAND_SHORT_PX = 58
export const BAND_HIDE_PX = 24

/** "2,5 mg" → "2,5" (a unidade vai no subtítulo quando algum rótulo encurta). */
export function shortDoseLabel(dose: string): string {
  return dose.split(' ')[0]
}

/** Chave do "Ver por etapa" aberto/fechado, por conta (FR-020 — troca de conta não herda). */
export const stepsStorageKey = (userId: string) => `measureSeriesSteps:${userId}:peso`
