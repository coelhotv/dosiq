// Candidatos a "mesmo remédio" para a caixa lida (spec 066 D1 · FR-015 · D-4).
//
// O matcher do core nunca decide: só ordena para a pergunta "É este que você já tem?". Composto de
// dose ambígua chega sem dose (INV-2) e o matcher descarta quem não tem dose — o genérico ambíguo
// nunca acharia candidato (CP-6). Aqui ele é consultado uma vez por concentração possível e as
// respostas se unem, sem mexer no core e sem escolher a dose pela pessoa.

import { findMedicineCandidates, type CandidateMedicineLike, type CmedMedicineDraft, type MedicineCandidate } from '@dosiq/core'

export const MAX_SCAN_CANDIDATES = 3

export function findScanCandidates<T extends CandidateMedicineLike>(
  draft: CmedMedicineDraft,
  medicines: readonly T[] | null | undefined,
): MedicineCandidate<T>[] {
  if (!medicines || medicines.length === 0) return []
  const variants =
    draft.dosage_per_pill === null && draft.strengthChoices.length > 0
      ? draft.strengthChoices.map((c) => ({ ...draft, dosage_per_pill: c.dose, dosage_unit: c.unit }))
      : [draft]

  const byMedicine = new Map<T, MedicineCandidate<T>>()
  for (const variant of variants) {
    for (const candidate of findMedicineCandidates(variant, medicines)) {
      const known = byMedicine.get(candidate.medicine)
      if (!known || (known.match === 'proximo' && candidate.match === 'identico')) {
        byMedicine.set(candidate.medicine, candidate)
      }
    }
  }
  const all = [...byMedicine.values()]
  return [...all.filter((c) => c.match === 'identico'), ...all.filter((c) => c.match === 'proximo')].slice(
    0,
    MAX_SCAN_CANDIDATES,
  )
}
