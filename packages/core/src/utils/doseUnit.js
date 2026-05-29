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
 * Formata um número com o separador de milhar brasileiro (ponto '.') e
 * separador decimal brasileiro (vírgula ',').
 * Seguro e de alto desempenho no Hermes (mobile) e V8 (web).
 *
 * @example formatNumberPtBR(3000)   → '3.000'
 * @example formatNumberPtBR(1.5)    → '1,5'
 * @example formatNumberPtBR(15000)  → '15.000'
 */
export function formatNumberPtBR(num) {
  if (num == null) return ''
  const normalized = typeof num === 'string' ? num.replace(',', '.') : num
  if (isNaN(Number(normalized))) return ''
  const parts = String(Number(normalized)).split('.')
  // Formata a parte inteira com ponto de milhar
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  // Se houver parte decimal, junta com vírgula
  return parts.length > 1 ? `${parts[0]},${parts[1]}` : parts[0]
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
  const display = formatNumberPtBR(qty)
  return `${display} ${pluralizeDoseUnit(qty)}`
}

/**
 * Retorna apenas o valor de concentração do princípio ativo correspondente.
 * Usado para hints em linhas separadas (como nos indicadores do Estoque).
 *
 * @example formatActiveIngredientShort(2, 600, 'mg')   → '1.200 mg'
 * @example formatActiveIngredientShort(1.5, 100, 'ui')  → '150 UI'
 * @example formatActiveIngredientShort(3, 1, 'gotas')  → ''
 */
export function formatActiveIngredientShort(qty, dosagePerPill, unit) {
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
  let total = qtyNum * dosagePerPill
  let currentUnit = unit

  // Conversão de unidade métrica para valores maiores ou iguais a 5.000
  if (total >= 5000) {
    if (unit === 'mcg') {
      total = total / 1000
      currentUnit = 'mg'
    } else if (unit === 'mg') {
      total = total / 1000
      currentUnit = 'g'
    } else if (unit === 'g') {
      total = total / 1000
      currentUnit = 'kg'
    } else if (unit === 'ml') {
      total = total / 1000
      currentUnit = 'l'
    }
  }

  const displayTotal = formatNumberPtBR(total)

  const totalUnitLabels = {
    mg: 'mg',
    mcg: 'mcg',
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'l',
    ui: 'UI',
    un: total === 1 ? 'unidade' : 'unidades',
    gotas: total === 1 ? 'gota' : 'gotas',
  }

  const displayTotalUnit = totalUnitLabels[currentUnit] || currentUnit || ''

  // Se o próprio medicamento for medido em unidades ou gotas e a dosagem unitária for 1,
  // a quantidade física já é a quantidade ativa (ex: "3 gotas"). Não precisa de concentração separada.
  if ((unit === 'un' || unit === 'gotas') && dosagePerPill === 1) {
    return ''
  }

  return `${displayTotal} ${displayTotalUnit}`.trim()
}

/**
 * Retorna um hint de equivalência amigável em parênteses na mesma linha.
 * Evita o sinal de igual ("=") que poluía visualmente.
 *
 * @example formatActiveIngredientHint(2, 100, 'ui')  → '2 un. (200 UI)'
 * @example formatActiveIngredientHint(30, 500, 'mg') → '30 un. (15.000 mg)'
 * @example formatActiveIngredientHint(3, 1, 'gotas') → '3 gotas'
 * @example formatActiveIngredientHint(1, 1, 'un')    → '1 unidade'
 */
export function formatActiveIngredientHint(qty, dosagePerPill, unit) {
  if (
    qty == null ||
    qty === '' ||
    isNaN(Number(String(qty).replace(',', '.')))
  ) {
    return ''
  }
  const qtyNum = Number(String(qty).replace(',', '.'))
  const displayQty = formatNumberPtBR(qtyNum)

  const unitLabels = {
    mg: 'mg',
    mcg: 'mcg',
    g: 'g',
    ml: 'ml',
    ui: 'UI',
    un: qtyNum === 1 ? 'unidade' : 'unidades',
    gotas: qtyNum === 1 ? 'gota' : 'gotas',
  }

  const displayUnit = unitLabels[unit] || 'un.'

  // Se o próprio medicamento for medido em unidades ou gotas e a dosagem unitária for 1
  if ((unit === 'un' || unit === 'gotas') && (dosagePerPill == null || dosagePerPill === 1)) {
    return `${displayQty} ${displayUnit}`
  }

  const shortVal = formatActiveIngredientShort(qty, dosagePerPill, unit)
  if (!shortVal) {
    return `${displayQty} ${displayUnit}`
  }

  // Se o medicamento for medido em unidades ou gotas com dosagem ativa em massa (ex: mg)
  if (unit === 'un') {
    return `${displayQty} un. (${shortVal})`
  }
  if (unit === 'gotas') {
    return `${displayQty} gotas (${shortVal})`
  }

  return `${displayQty} un. (${shortVal})`
}

/**
 * Retorna a frase explicativa simples de equivalência ativa para inputs.
 * Substitui a fórmula de "1,5 x 100 UI = 150 UI" por uma declaração direta "Equivale a 150 UI".
 *
 * @example formatActiveIngredientFormula(1.5, 100, 'ui') → 'Equivale a 150 UI'
 * @example formatActiveIngredientFormula(3, 1, 'gotas') → 'Equivale a 3 gotas'
 */
export function formatActiveIngredientFormula(qty, dosagePerPill, unit) {
  if (
    qty == null ||
    qty === '' ||
    isNaN(Number(String(qty).replace(',', '.')))
  ) {
    return ''
  }
  
  const qtyNum = Number(String(qty).replace(',', '.'))
  const displayQty = formatNumberPtBR(qtyNum)

  const unitLabels = {
    mg: 'mg',
    mcg: 'mcg',
    g: 'g',
    ml: 'ml',
    ui: 'UI',
    un: qtyNum === 1 ? 'unidade' : 'unidades',
    gotas: qtyNum === 1 ? 'gota' : 'gotas',
  }

  const displayUnit = unitLabels[unit] || 'un.'

  if ((unit === 'un' || unit === 'gotas') && (dosagePerPill == null || dosagePerPill === 1)) {
    return `Equivale a ${displayQty} ${displayUnit}`
  }

  const shortVal = formatActiveIngredientShort(qty, dosagePerPill, unit)
  if (!shortVal) {
    return `Equivale a ${displayQty} ${displayUnit}`
  }

  return `Equivale a ${shortVal}`
}


