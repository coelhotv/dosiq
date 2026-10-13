// Candidatos a "mesmo remédio" antes de cadastrar (spec 066 FR-015 · CON-038).
//
// O matcher NUNCA decide identidade: só ordena candidatos para a pergunta
// "É este que você já tem?". Nome e princípio ativo são editáveis pelo usuário e
// genérico não tem nome oficial, então a chave natural não é confiável entre fontes.
//   identico — marca com o mesmo registro ANVISA; ou substâncias + dose + unidade + forma iguais
//   proximo  — dose + unidade iguais e ao menos um termo significativo em comum no nome/substância

import { normalizeText } from '../anvisaDatabase'

export interface CandidateMedicineLike {
  id?: string
  name?: string | null
  active_ingredient?: string | null
  dosage_per_pill?: number | string | null
  dosage_unit?: string | null
  presentation?: string | null
  anvisa_registration?: string | null
}

export interface CandidateDraftLike {
  name: string
  active_ingredient: string
  dosage_per_pill: number | null
  dosage_unit: string | null
  presentation: string | null
  anvisa_registration: string | null
}

export type CandidateMatch = 'identico' | 'proximo'

export interface MedicineCandidate<T extends CandidateMedicineLike> {
  medicine: T
  match: CandidateMatch
}

// Conectivos e formas de sal/hidrato: mudam entre fontes sem mudar o princípio ativo.
const NOISE_TOKENS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'com',
  'cloridrato', 'dicloridrato', 'maleato', 'besilato', 'mesilato', 'bissulfato', 'sulfato',
  'fumarato', 'succinato', 'tartarato', 'citrato', 'acetato', 'fosfato', 'bromidrato',
  'hemifumarato', 'sodico', 'sodica', 'potassico', 'potassica', 'calcico', 'calcica',
  'magnesico', 'monossodico', 'dissodico',
])
const HYDRATE = /i?dratad[oa]$|^(mono|di|tri|tetra|penta|hemi|sesqui)$/

function tokens(text: string | null | undefined): Set<string> {
  const out = new Set<string>()
  for (const raw of normalizeText(text).split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || NOISE_TOKENS.has(raw) || HYDRATE.test(raw)) continue
    out.add(raw)
  }
  return out
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  return Number.isFinite(n) ? n : null
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (x.length >= 4 && b.has(x)) return true
  return false
}

/** Candidatos `identico` primeiro, depois `proximo`; ordem da lista preservada dentro de cada grupo. */
export function findMedicineCandidates<T extends CandidateMedicineLike>(
  draft: CandidateDraftLike,
  medicines: readonly T[] | null | undefined
): MedicineCandidate<T>[] {
  if (!medicines || medicines.length === 0) return []
  const draftDose = draft.dosage_per_pill
  const draftSubstances = tokens(draft.active_ingredient)
  const draftTerms = new Set([...tokens(draft.name), ...draftSubstances])
  const identicos: MedicineCandidate<T>[] = []
  const proximos: MedicineCandidate<T>[] = []

  for (const medicine of medicines) {
    if (
      draft.anvisa_registration &&
      medicine.anvisa_registration &&
      draft.anvisa_registration === medicine.anvisa_registration
    ) {
      identicos.push({ medicine, match: 'identico' })
      continue
    }
    if (draftDose === null || !draft.dosage_unit) continue
    const dose = toNumber(medicine.dosage_per_pill)
    if (dose === null || dose !== draftDose || medicine.dosage_unit !== draft.dosage_unit) continue

    const substances = tokens(medicine.active_ingredient)
    if (
      draft.presentation &&
      medicine.presentation === draft.presentation &&
      sameSet(draftSubstances, substances)
    ) {
      identicos.push({ medicine, match: 'identico' })
      continue
    }
    const terms = new Set([...tokens(medicine.name), ...substances])
    if (overlaps(draftTerms, terms)) proximos.push({ medicine, match: 'proximo' })
  }
  return [...identicos, ...proximos]
}
