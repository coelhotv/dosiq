// medicineDraftValues — do rascunho da caixa (busca 2C ou código de barras) para o form do remédio.
//
// Spec 066: nasceu no `MedicineFormScreen` (Slice C/D1) e foi extraído na Slice E para o passo
// "Seu primeiro remédio" do onboarding aplicar o MESMO mapeamento (reuso obrigatório, nunca cópia).

// Valores do form a partir da embalagem escolhida (o rascunho prevalece sobre `base`).
export function valuesFromDraft(base, draft, current) {
  const presentation = draft.presentation
  return {
    ...base,
    name: draft.name || base.name,
    active_ingredient: draft.active_ingredient ?? base.active_ingredient,
    therapeutic_class: draft.therapeutic_class ?? base.therapeutic_class,
    regulatory_category: draft.regulatory_category ?? base.regulatory_category,
    laboratory: draft.laboratory ?? '',
    anvisa_registration: draft.anvisa_registration,
    // INV-2: dose ambígua nunca é preenchida.
    dosage_per_pill: draft.dosage_per_pill !== null ? String(draft.dosage_per_pill) : '',
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
export function scanDoseEdited(values, scanInfo) {
  return (
    String(values.dosage_per_pill ?? '') !== String(scanInfo.dosage_per_pill ?? '') ||
    (values.dosage_unit ?? null) !== (scanInfo.dosage_unit ?? null)
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
    regulatory_category: draft.regulatory_category,
    laboratory: draft.laboratory ?? '',
    anvisa_registration: draft.anvisa_registration,
  }
}
