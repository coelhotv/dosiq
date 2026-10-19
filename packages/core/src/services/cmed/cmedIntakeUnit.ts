// Unidade da TOMADA (gotas · mL · UI · mg) deduzida da caixa — spec 066 Slice E, C-7 (smoke 2026-10-18).
//
// Por quê: o onboarding não pergunta a unidade da dose (o mínimo de campos é o desenho do primeiro
// acesso, como os presets de horário). Sem ela o tratamento de um líquido nascia com `intake_unit` NULL,
// que o app lê como mL — o colírio Tobradex virou "1 mL" e o estoque descontaria 1 mL por dose.
//
// O texto da apresentação CMED (`a`) diz como o remédio é usado. Regra medida no índice v1.1.19 (4.672
// linhas com concentração `*/ml`), a primeira que casar vale:
//   1. não injetável com GOT/CGT/OFT/OTO     → gotas (16,8% — inclui vitamina D `ui/ml` em gotas)
//   2. concentração `ui/ml`                   → UI    (4,5% — insulinas)
//   3. injetável com `mg/ml`                  → mg    (49,3% — GLP-1, enoxaparina; `doseToMl` converte)
//   4. outro injetável                        → mL
//   5. XPE/ELX/OR/ORAL/GRAN/COP/SER DOS       → mL    (23,2% — xarope, suspensão oral)
//   6. resto (spray, tópico, xampu — 6,2%)    → o padrão do form completo (`defaultIntakeUnitFor`)
// A ordem importa: gotas antes de UI (vitamina D em gotas tem concentração `ui/ml`).

import { isLiquidDosageUnit } from '../../utils/doseUnit'

const DROPS = /\b(GOT|CGT|OFT|OTO)\b/
const INJECTION = /\b(INJ|INFUS)\b/
const ORAL_ML = /\b(XPE|ELX|OR|ORAL|GRAN|COP)\b|SER DOS/

/**
 * Unidade padrão da tomada para um remédio, sem olhar a caixa: a mesma do form completo de tratamento
 * (`ProtocolFormBody`). Líquido `ui/ml` → UI; outro líquido → gotas; não líquido → null (comprimido).
 */
export function defaultIntakeUnitFor(dosageUnit: string | null | undefined): string | null {
  if (!isLiquidDosageUnit(dosageUnit)) return null
  return dosageUnit === 'ui/ml' ? 'UI' : 'gotas'
}

/**
 * Unidade da tomada a partir do texto da apresentação CMED. Não líquido → null. Sem regra → o padrão do
 * form completo. Nunca lança.
 */
export function intakeUnitFromPresentation(
  text: string | null | undefined,
  dosageUnit: string | null | undefined,
  presentation: string | null | undefined,
): string | null {
  if (!isLiquidDosageUnit(dosageUnit)) return null
  const t = (text ?? '').toUpperCase()
  const injectable = presentation === 'injetavel' || INJECTION.test(t)
  if (!injectable && DROPS.test(t)) return 'gotas'
  if (dosageUnit === 'ui/ml') return 'UI'
  if (injectable) return dosageUnit === 'mg/ml' ? 'mg' : 'ml'
  if (ORAL_ML.test(t)) return 'ml'
  return defaultIntakeUnitFor(dosageUnit)
}
