// trackedMeasureField — "Acompanhar nas doses" no form do tratamento (spec 100 B · FR-004/FR-005).
//
// Puro. O form guarda `tracked_measure: null` enquanto o usuário não toca no campo: a pré-seleção
// é a inferência (matriz da classe CMED × frequência, `inferMeasure` do core) e acompanha a troca de
// medicamento/frequência. Tocou ⇒ o valor fica (INV-1). Nada é gravado fora do save (FR-005).

import { inferMeasure, type TrackedMeasure } from '@dosiq/core'

export const TRACKED_MEASURE_OPTIONS: ReadonlyArray<{ value: TrackedMeasure; label: string }> = [
  { value: 'peso', label: 'Peso' },
  { value: 'glicemia', label: 'Glicemia' },
  { value: 'pressao_arterial', label: 'Pressão' },
  { value: 'nenhum', label: 'Nenhum' },
]

type FormValues = { tracked_measure?: TrackedMeasure | null; frequency?: string | null }
type MedicineLike = { therapeutic_class_code?: string | null } | null | undefined

/** O que o campo mostra selecionado. */
export function displayedTrackedMeasure(values: FormValues, medicine: MedicineLike): TrackedMeasure {
  if (values.tracked_measure != null) return values.tracked_measure
  return inferMeasure({ classCode: medicine?.therapeutic_class_code, frequency: values.frequency })
}

/** Valor a gravar no save e a origem (FR-012): 'inferred' = salvou a pré-seleção; 'chosen' = tocou. */
export function resolveTrackedMeasure(
  values: FormValues,
  medicine: MedicineLike
): { value: TrackedMeasure; source: 'inferred' | 'chosen' } {
  return {
    value: displayedTrackedMeasure(values, medicine),
    source: values.tracked_measure != null ? 'chosen' : 'inferred',
  }
}
