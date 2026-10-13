// Linha do índice CMED → rascunho do cadastro de medicamento (spec 066 Slice A · CON-038).
//
// Só transcreve a caixa: nada aqui grava (INV-1). Regras clínicas:
//   D1  dose = `d` (1º número da APRESENTAÇÃO, já resolvido pelo pipeline)
//   D6  `amb` ⇒ dose em branco, mesmo se o arquivo trouxer `d` (defesa em profundidade, INV-2)
//   D9  força completa para exibição (`strengthLabel`), nunca o escalar truncado
//   D11 genérico: sem registro e sem laboratório no cadastro; laboratório só para exibir

import { DOSAGE_UNITS, PRESENTATIONS, normalizeRegulatoryCategory } from '../../schemas/medicineSchema'
import { formatStrength } from '../../utils/doseUnit'
import type { CmedRow } from './cmedIndex'

export interface CmedMedicineDraft {
  name: string
  active_ingredient: string
  dosage_per_pill: number | null
  dosage_unit: string | null
  presentation: string
  laboratory: string | null
  anvisa_registration: string | null
  regulatory_category: string | null
  therapeutic_class: string | null
  /** Exibição: força completa ("500 mg + 125 mg"). */
  strengthLabel: string | null
  /** Exibição: laboratório da caixa, inclusive de genérico. */
  displayLaboratory: string | null
  /** Quantidade da caixa (`X <n>`); em líquido é volume, não contagem. */
  boxQuantity: number | null
  /** Ordem de dose indecidível: a dose fica em branco e a UI pede para ler a caixa. */
  doseAmbiguous: boolean
  isGeneric: boolean
}

const UNIT_SET = new Set<string>(DOSAGE_UNITS)
const PRESENTATION_SET = new Set<string>(PRESENTATIONS)

export function medicineDraftFromRow(row: CmedRow): CmedMedicineDraft {
  const isGeneric = row.k === 'generico'
  const unit = row.u !== null && UNIT_SET.has(row.u) ? row.u : null
  const dose = row.amb || unit === null ? null : row.d
  return {
    name: row.p,
    active_ingredient: row.s,
    dosage_per_pill: dose,
    dosage_unit: unit,
    presentation: row.f !== null && PRESENTATION_SET.has(row.f) ? row.f : 'outro',
    laboratory: isGeneric ? null : row.l,
    anvisa_registration: !isGeneric && /^[0-9]{9}$/.test(row.r) ? row.r : null,
    regulatory_category: normalizeRegulatoryCategory(row.k),
    therapeutic_class: row.cn,
    strengthLabel: formatStrength(row.ds, dose, unit),
    displayLaboratory: row.l,
    boxQuantity: row.q,
    doseAmbiguous: row.amb,
    isGeneric,
  }
}
