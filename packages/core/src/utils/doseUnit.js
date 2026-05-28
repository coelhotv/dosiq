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

/**
 * Retorna um hint de equivalência ligando a quantidade física (un.) à carga de dosagem.
 * @example formatActiveIngredientHint(2, 100, 'ui') -> "2 un. = 200 UI"
 * @example formatActiveIngredientHint(30, 500, 'mg') -> "30 un. = 15000 mg"
 */
export function formatActiveIngredientHint(qty, dosagePerPill, unit) {
  if (
    qty == null ||
    qty === '' ||
    isNaN(Number(String(qty).replace(',', '.'))) ||
    dosagePerPill == null ||
    dosagePerPill <= 0
  ) {
    return ''
  }
  const qtyNum = Number(String(qty).replace(',', '.'))
  const total = qtyNum * dosagePerPill
  const displayQty = String(qtyNum).replace('.', ',')
  const displayTotal = String(total).replace('.', ',')

  const unitLabels = {
    mg: 'mg',
    mcg: 'mcg',
    g: 'g',
    ml: 'ml',
    ui: 'UI',
    cp: qtyNum === 1 ? 'comprimido' : 'comprimidos',
    gotas: qtyNum === 1 ? 'gota' : 'gotas',
  }

  const totalUnitLabels = {
    mg: 'mg',
    mcg: 'mcg',
    g: 'g',
    ml: 'ml',
    ui: 'UI',
    cp: total === 1 ? 'comprimido' : 'comprimidos',
    gotas: total === 1 ? 'gota' : 'gotas',
  }

  const displayUnit = unitLabels[unit] || unit || 'un.'
  const displayTotalUnit = totalUnitLabels[unit] || unit || 'un.'

  // Se o próprio medicamento for medido em comprimidos ou gotas e a dosagem unitária for 1
  if ((unit === 'cp' || unit === 'gotas') && dosagePerPill === 1) {
    return `${displayQty} ${displayUnit}`
  }

  // Se o medicamento for medido em comprimidos ou gotas com dosagem ativa em massa (ex: mg)
  if (unit === 'cp') {
    return `${displayQty} comp. = ${displayTotal} mg`
  }
  if (unit === 'gotas') {
    return `${displayQty} ${displayUnit} = ${displayTotal} gotas`
  }

  return `${displayQty} un. = ${displayTotal} ${displayTotalUnit}`
}

/**
 * Retorna a fórmula matemática explicativa para helpers de inputs.
 * @example formatActiveIngredientFormula(1.5, 100, 'ui') -> "1,5 x 100 UI = 150 UI"
 */
export function formatActiveIngredientFormula(qty, dosagePerPill, unit) {
  if (
    qty == null ||
    qty === '' ||
    isNaN(Number(String(qty).replace(',', '.'))) ||
    dosagePerPill == null ||
    dosagePerPill <= 0
  ) {
    return ''
  }
  const qtyNum = Number(String(qty).replace(',', '.'))
  const total = qtyNum * dosagePerPill
  const displayQty = String(qtyNum).replace('.', ',')
  const displayTotal = String(total).replace('.', ',')

  const unitLabels = {
    mg: 'mg',
    mcg: 'mcg',
    g: 'g',
    ml: 'ml',
    ui: 'UI',
    cp: 'comp.',
    gotas: 'gotas',
  }

  const displayUnit = unitLabels[unit] || unit || 'un.'

  if ((unit === 'cp' || unit === 'gotas') && dosagePerPill === 1) {
    return `${displayQty} ${displayUnit === 'comp.' ? (qtyNum === 1 ? 'comprimido' : 'comprimidos') : (qtyNum === 1 ? 'gota' : 'gotas')}`
  }

  if (unit === 'cp') {
    return `${displayQty} x ${dosagePerPill} mg = ${displayTotal} mg`
  }

  return `${displayQty} x ${dosagePerPill} ${displayUnit} = ${displayTotal} ${displayUnit}`
}


