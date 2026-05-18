// doseUnit.js — Apresentação de quantidade de DOSE (Fase 2).
//
// `dosage_per_intake` representa NÚMERO DE UNIDADES farmacêuticas do
// medicamento por tomada (1 comprimido, 1 ampola, 1 gota, etc), NÃO a
// quantidade em mg/ml/etc. A apresentação (`dosage_per_pill` + `dosage_unit`
// no medicamento) é a carga POR UNIDADE — exibida separadamente no hero card.
//
// Padronização (2026-05-17): sempre "unidade(s)", independente da apresentação.
// Tentar mapear (mg→comprimido, ml→ml, gotas→gota) gerava bugs semânticos
// como "Apidra 2ml — dose por tomada: 1 ml" (deveria ser "1 unidade [de 2ml]").
//
// Hermes (mobile) sem ICU completo: toLocaleString('pt-BR') cai em fallback
// US. Por isso usamos replace('.', ',') manual (confiável em V8 e Hermes).

/**
 * Retorna "unidade" (singular) ou "unidades" (plural) baseado na quantidade.
 * Coerce explícito via Number — valores podem chegar como string de TextInput.
 *
 * @example pluralizeDoseUnit(1)   → 'unidade'
 * @example pluralizeDoseUnit(2)   → 'unidades'
 * @example pluralizeDoseUnit(0.5) → 'unidades'
 * @example pluralizeDoseUnit('1') → 'unidade'
 */
export function pluralizeDoseUnit(qty) {
  return Number(qty) === 1 ? 'unidade' : 'unidades'
}

/**
 * Formata quantidade + "unidade(s)" para exibição. Vírgula decimal PT-BR.
 *
 * @example formatDoseUnit(1)    → '1 unidade'
 * @example formatDoseUnit(2)    → '2 unidades'
 * @example formatDoseUnit(0.5)  → '0,5 unidades'
 * @example formatDoseUnit(15.5) → '15,5 unidades'
 */
export function formatDoseUnit(qty) {
  const display = String(qty).replace('.', ',')
  return `${display} ${pluralizeDoseUnit(qty)}`
}
