// chartScale.ts — escala "nice" do eixo Y dos gráficos de medida (012 ScatterTrend; reusada pelo
// gráfico de peso por etapa da 069 Bb). Movida do componente sem mudança (react-refresh).

// "Passo bonito" p/ a escala do eixo Y (1/2/5 × 10ⁿ).
function niceStep(raw: number): number {
  if (raw <= 0) return 10
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const m = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10
  return m * pow
}

// Escala Y a partir de min/max dos dados → {lo, hi, ticks:[hi,mid,lo]} (topo→base).
export function buildScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 100, ticks: [100, 50, 0] }
  if (min === max) { const lo = Math.max(0, min - 10); const hi = min + 10; return { lo, hi, ticks: [hi, (lo + hi) / 2, lo] } }
  const step = niceStep(max - min)
  const lo = Math.max(0, Math.floor(min / step) * step)
  const hi = Math.ceil(max / step) * step
  const mid = (lo + hi) / 2
  return { lo, hi, ticks: [hi, mid, lo] }
}

export function fmtTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}
