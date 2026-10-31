// medicineDraftValues — do rascunho da caixa (busca 2C ou código de barras) para o form do remédio.
//
// Spec 066: nasceu no `MedicineFormScreen` (Slice C/D1) e foi extraído na Slice E para o passo
// "Seu primeiro remédio" do onboarding aplicar o MESMO mapeamento (reuso obrigatório, nunca cópia).
//
// Spec 113 (ADR-066): o form mostra o valor da CAIXA (razão × volume do rótulo) e o banco guarda a
// RAZÃO + volume. `labelAmount` leva para a caixa; `normalizeConcentration` volta para a razão.

import { cleanFloat, isLiquidDosageUnit, labelAmount } from '@dosiq/core'

function positiveNumber(value) {
  const num = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(num) && num > 0 ? num : null
}

// Volume do rótulo que conta: unidade líquida e volume > 0 e ≠ 1 (vazio/1 = "por mL").
function labelVolume(values) {
  if (!isLiquidDosageUnit(values.dosage_unit)) return null
  const vol = positiveNumber(values.concentration_volume_ml)
  return vol !== null && vol !== 1 ? vol : null
}

// Valores do form (domínio da caixa) → o que se grava (razão + volume). Regra única do form
// completo e do onboarding (FR-005). Dose vazia ⇒ null (Gemini #661: Number('') = 0 corromperia).
export function normalizeConcentration(values) {
  const denom = labelVolume(values) ?? 1
  const raw = values.dosage_per_pill
  const hasAmount = raw !== '' && raw !== null && raw !== undefined
  const amount = hasAmount ? Number(String(raw).replace(',', '.')) : NaN
  return {
    dosage_per_pill: hasAmount && Number.isFinite(amount) ? cleanFloat(amount / denom) : null,
    concentration_volume_ml: denom !== 1 ? denom : null,
  }
}

// Onboarding: só reescreve o payload quando há volume do rótulo (ou volume órfão de unidade não
// líquida a limpar); sem isso devolve o MESMO objeto — payload de hoje intacto.
export function withNormalizedConcentration(values) {
  if (!values) return values
  const hasVolumeField = String(values.concentration_volume_ml ?? '').trim() !== ''
  if (labelVolume(values) === null && !hasVolumeField) return values
  return { ...values, ...normalizeConcentration(values) }
}

// Valores do form a partir da embalagem escolhida (o rascunho prevalece sobre `base`).
export function valuesFromDraft(base, draft, current) {
  const presentation = draft.presentation
  return {
    ...base,
    name: draft.name || base.name,
    active_ingredient: draft.active_ingredient ?? base.active_ingredient,
    therapeutic_class: draft.therapeutic_class ?? base.therapeutic_class,
    // 100 B (FR-001): código EphMRA da caixa, já normalizado pelo rascunho do core (C-A3). Caixa sem
    // código ⇒ null — nunca o código de uma escolha anterior (o setValues do form faz merge, C-B3).
    therapeutic_class_code: draft.therapeutic_class_code ?? null,
    regulatory_category: draft.regulatory_category ?? base.regulatory_category,
    laboratory: draft.laboratory ?? '',
    anvisa_registration: draft.anvisa_registration,
    // INV-2: dose ambígua nunca é preenchida. Spec 113: com volume do rótulo, o valor da caixa.
    dosage_per_pill:
      draft.dosage_per_pill !== null ? String(labelAmount(draft.dosage_per_pill, draft.concentration_volume_ml)) : '',
    // Sempre escrito: caixa sem volume limpa o de uma escolha anterior (setValues faz merge, C-B3).
    concentration_volume_ml: draft.concentration_volume_ml ? String(draft.concentration_volume_ml) : '',
    // C-C10 (B8 "500 mg/"): unidade que o app não reconhece fica vazia — o "mg" padrão seria um chute.
    dosage_unit: draft.dosage_unit ?? (draft.strengthLabel ? '' : current.dosage_unit),
    presentation,
    shelf_life_days: presentation === 'injetavel' && !current.shelf_life_days ? '28' : current.shelf_life_days,
  }
}

// O que a caixa muda no form além dos valores: guarda da dose ambígua (INV-2), escolhas de 1 toque
// (C-C10) e a força de referência "Na embalagem" (D9).
export function draftExtras(draft) {
  // Referência "Na embalagem": composto, ou força que o app não converte (C-C10, B8 "500 mg/").
  const showStrength = !!draft.strengthLabel && (draft.strengthLabel.includes('+') || draft.dosage_per_pill === null)
  return {
    doseCheckRequired: draft.doseAmbiguous,
    strengthChoices: draft.strengthChoices,
    strengthLabel: showStrength ? draft.strengthLabel : null,
  }
}

// PO-11: só se a pessoa corrigiu a dose da caixa — nunca o valor (`scan_confirmed.dose_edited`).
// Spec 113 (FR-006b): compara no domínio da caixa — form (2,5 · 0,5 mL) × rascunho levado à caixa.
export function scanDoseEdited(values, scanInfo) {
  const scanDose =
    scanInfo.dosage_per_pill === null || scanInfo.dosage_per_pill === undefined
      ? ''
      : String(labelAmount(scanInfo.dosage_per_pill, scanInfo.concentration_volume_ml))
  return (
    String(values.dosage_per_pill ?? '') !== scanDose ||
    (values.dosage_unit ?? null) !== (scanInfo.dosage_unit ?? null) ||
    labelVolume(values) !== labelVolume({ dosage_unit: scanInfo.dosage_unit, concentration_volume_ml: scanInfo.concentration_volume_ml })
  )
}

// 066 D1: base do form a partir só da caixa lida (sem item da base ANVISA). O rascunho prevalece
// em `valuesFromDraft`; aqui só o que ele não traz.
export function baseFromScan(draft, current) {
  return {
    ...current,
    name: draft.name,
    active_ingredient: draft.active_ingredient,
    therapeutic_class: draft.therapeutic_class,
    therapeutic_class_code: draft.therapeutic_class_code ?? null,
    regulatory_category: draft.regulatory_category,
    laboratory: draft.laboratory ?? '',
    anvisa_registration: draft.anvisa_registration,
  }
}
