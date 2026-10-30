/**
 * trackedMeasure — qual medida um tratamento acompanha (spec 100 · ADR-121).
 *
 * Puro, sem I/O. Dois papéis distintos:
 * - `inferMeasure`: matriz classe CMED → medida, roda SÓ no form (criar/editar) para pré-selecionar
 *   o campo. Nunca em leitura, sync ou migração (FR-005, INV-1).
 * - `effectiveMeasure`: o que o runtime (pedido pós-dose, card) obedece. Lê só `tracked_measure` +
 *   `frequency` do tratamento — a classe do medicamento não entra no fluxo de dose (RC3 E-2).
 *
 * Informativo (ADR-062): decide QUAL medida pedir/mostrar, nunca interpreta o valor medido.
 */
import { THERAPEUTIC_CLASS_CODE_REGEX } from '../schemas/medicineSchema'
import { TRACKED_MEASURES, type TrackedMeasure } from '../schemas/protocolSchema'

export type Measure = Exclude<TrackedMeasure, 'nenhum'>

/**
 * Matriz FR-002 (PO 2026-10-29). Prefixo mais longo vence: GLP-1/antiobesidade (`A10S`, `A10X9`)
 * ganham de `A10` (antidiabéticos). Códigos EphMRA do índice CMED (sem zero à esquerda: `C7A`).
 */
export const MEASURE_CLASS_MATRIX: ReadonlyArray<readonly [prefix: string, measure: Measure]> = [
  ['A10', 'glicemia'],
  ['A8A', 'peso'],
  ['A10S', 'peso'],
  ['A10X9', 'peso'],
  ['C2', 'pressao_arterial'],
  ['C3', 'pressao_arterial'],
  ['C7', 'pressao_arterial'],
  ['C8', 'pressao_arterial'],
  ['C9', 'pressao_arterial'],
]

/** Trim + maiúsculas; `null` se vazio ou fora do formato do CHECK do banco. */
export function normalizeClassCode(code: string | null | undefined): string | null {
  if (typeof code !== 'string') return null
  const normalized = code.trim().toUpperCase()
  return THERAPEUTIC_CLASS_CODE_REGEX.test(normalized) ? normalized : null
}

/** Regra da 069: tratamento semanal acompanha peso; o resto, nada. */
function fallbackMeasure(frequency: string | null | undefined): TrackedMeasure {
  return frequency === 'semanal' ? 'peso' : 'nenhum'
}

export function inferMeasure({
  classCode,
  frequency,
}: {
  classCode: string | null | undefined
  frequency: string | null | undefined
}): TrackedMeasure {
  const code = normalizeClassCode(classCode)
  if (code === null) return fallbackMeasure(frequency)
  let best: readonly [string, Measure] | null = null
  for (const entry of MEASURE_CLASS_MATRIX) {
    if (code.startsWith(entry[0]) && (best === null || entry[0].length > best[0].length)) best = entry
  }
  return best === null ? fallbackMeasure(frequency) : best[1]
}

export type EffectiveMeasure = TrackedMeasure | { missing: true }

const TRACKED_SET = new Set<string>(TRACKED_MEASURES)

/**
 * Medida que o runtime obedece. Chave AUSENTE (select sem a coluna — RC3 E-1) ou valor fora do
 * enum ⇒ `{ missing: true }`: o chamador falha fechado (não pede, avisa no Sentry), nunca cai no
 * fallback — pedir peso a quem escolheu "nenhum" é pior que não pedir.
 */
export function effectiveMeasure(protocol: { frequency?: string | null; tracked_measure?: unknown }): EffectiveMeasure {
  if (!Object.prototype.hasOwnProperty.call(protocol, 'tracked_measure')) return { missing: true }
  const value = protocol.tracked_measure
  if (value === null) return fallbackMeasure(protocol.frequency)
  if (typeof value === 'string' && TRACKED_SET.has(value)) return value as TrackedMeasure
  return { missing: true }
}
