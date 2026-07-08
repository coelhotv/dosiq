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

import { DOSAGE_UNIT_LABELS } from '../schemas/medicineSchema'
import { cleanFloat } from './formUtils'

interface MedicineLike {
  dosage_unit?: string | null
  dosage_per_pill?: number | string | null
  units_per_ml?: number | string | null
  concentration_volume_ml?: number | string | null
}

interface DoseItemLike {
  dosagePerIntake?: number | string
  intakeUnit?: string | null
  dosageUnit?: string | null
  dosagePerPill?: number | string | null
  unitsPerMl?: number | string | null
}

/**
 * Converte string ou número para número de forma segura.
 * @private
 */
function parseNumber(val: number | string | null | undefined): number {
  if (typeof val === 'string') {
    return Number(val.replace(',', '.'))
  }
  return Number(val)
}

/**
 * Formata a parte líquida quando volumeMl não é nulo/1.
 * @private
 */
function formatLiquidConcentration(ratio: number, vol: number, unit: string | null | undefined): string {
  const baseUnit = (unit || 'mg/ml').split('/')[0]
  const baseLabel = DOSAGE_UNIT_LABELS[baseUnit as keyof typeof DOSAGE_UNIT_LABELS] || baseUnit
  return `${formatNumberPtBR(cleanFloat(ratio * vol))} ${baseLabel} / ${formatNumberPtBR(vol)}ml`
}

/**
 * Obtém o rótulo de dosagem formatado.
 * @private
 */
function getConcentrationLabel(v: string, unit: string | null | undefined): string {
  const label = (unit && DOSAGE_UNIT_LABELS[unit as keyof typeof DOSAGE_UNIT_LABELS]) || unit || ''
  return label ? `${v} ${label}` : v
}

/**
 * Formata a concentração/apresentação do medicamento (pill) com a unidade
 * normalizada via DOSAGE_UNIT_LABELS — UI em allcaps, ml em minúsculo, UI/ml etc.
 * Centraliza o que antes era `${dosage_per_pill}${dosage_unit}` cru (mostrava
 * "ui/ml" minúsculo) espalhado por listagem, estoque, histórico e notificações.
 *
 * 012 Fase B3 (FR-031): quando o líquido tem denominador de rótulo ≠ 1 mL (ex:
 * Mounjaro), reconstrói a leitura original do rótulo — `amount unidadeBase / volume mL`
 * ('2,5 mg / 0,5 mL') em vez da razão normalizada crua ('5 mg/ml'), que confunde.
 * Volume NULL/1 ou sólido → comportamento clássico inalterado.
 *
 * @param {number|string|null} value - dosage_per_pill (razão por unidade/ml)
 * @param {string|null} unit - dosage_unit ('mg', 'ui/ml', 'mg/ml', 'un', …)
 * @param {number|string|null} [volumeMl=null] - concentration_volume_ml (denominador do rótulo)
 * @returns {string} ex: '100 UI/ml' · '500 mg' · '2,5 mg / 0,5 mL' · '' se value vazio
 */
export function formatConcentration(
  value: number | string | null | undefined,
  unit: string | null | undefined,
  volumeMl: number | string | null = null
): string {
  if (value === undefined || value === null || value === '') return ''
  const ratio = parseNumber(value)
  const vol = parseNumber(volumeMl)
  const isLiquid = Boolean(unit?.endsWith('/ml'))
  if (
    isLiquid &&
    ratio > 0 &&
    vol > 0 &&
    vol !== 1 &&
    Number.isFinite(ratio) &&
    Number.isFinite(vol)
  ) {
    return formatLiquidConcentration(ratio, vol, unit)
  }
  const v = formatNumberPtBR(value)
  if (v === '') return ''
  return getConcentrationLabel(v, unit)
}

/**
 * Açúcar p/ chamar formatConcentration a partir de um objeto medicine (snake_case).
 * Mantém call sites de card limpos (passa o objeto inteiro).
 *
 * @param {{dosage_per_pill?: number|string|null, dosage_unit?: string|null, concentration_volume_ml?: number|string|null}|null} medicine
 * @returns {string}
 */
export function formatMedicineConcentration(medicine: MedicineLike | null | undefined): string {
  if (!medicine) return ''
  return formatConcentration(
    medicine.dosage_per_pill,
    medicine.dosage_unit,
    medicine.concentration_volume_ml
  )
}

/**
 * Decisão-mãe líquido (022): medicamento é líquido quando dosage_unit termina
 * em '/ml' (mg/ml, ui/ml). Centraliza o predicado antes duplicado inline em
 * telas de estoque/tratamento (evita drift — ex: esquecer endsWith em uma tela).
 *
 * @param {{dosage_unit?: string}|null} medicine
 * @returns {boolean}
 */
export function isLiquidMedicine(medicine: { dosage_unit?: string | null } | null | undefined): boolean {
  return Boolean(medicine?.dosage_unit?.endsWith('/ml'))
}

/**
 * Sufixo curto p/ contagens de estoque (saldo, consumo/dia, comprado, custo).
 * Líquido → 'ml'; sólido → 'un.'. Usado em KPIs e custos ("R$ X / ml").
 *
 * @param {{dosage_unit?: string}|null} medicine
 * @returns {'ml'|'un.'}
 */
export function stockUnitLabel(medicine: { dosage_unit?: string | null } | null | undefined): 'ml' | 'un.' {
  return isLiquidMedicine(medicine) ? 'ml' : 'un.'
}

/**
 * Contagem simples de estoque p/ "compradas/restantes": líquido "X ml",
 * sólido "X unidade(s)". Diferente de formatStockQuantity (que adiciona hint de
 * princípio ativo no sólido) — aqui é só a contagem crua na unidade certa.
 *
 * @param {number|string} qty
 * @param {{dosage_unit?: string}|null} medicine
 * @returns {string}
 * @example formatStockCount(30, {dosage_unit:'mg/ml'}) → '30 ml'
 * @example formatStockCount(30, {dosage_unit:'mg'})    → '30 unidades'
 */
export function formatStockCount(qty: number | string, medicine: { dosage_unit?: string | null } | null | undefined): string {
  if (isLiquidMedicine(medicine)) return formatDose(qty, 'ml')
  return formatDoseUnit(qty)
}

/**
 * Saldo de estoque formatado p/ display destacado. Líquido → "X ml"; sólido →
 * hint de princípio ativo ("30 un. (15.000 mg)") com fallback "X un.".
 *
 * @param {number|string} qty
 * @param {{dosage_unit?: string, dosage_per_pill?: number}|null} medicine
 * @returns {string}
 */
export function formatStockQuantity(qty: number | string, medicine: MedicineLike | null | undefined): string {
  if (isLiquidMedicine(medicine)) return formatDose(qty, 'ml')
  return (
    formatActiveIngredientHint(qty, medicine?.dosage_per_pill, medicine?.dosage_unit) ||
    `${formatNumberPtBR(qty)} un.`
  )
}

/**
 * Rótulo de concentração: "[amount] mg em [volume] mL". Reconstrói a leitura da caixa
 * (012 Fase B3, FR-031/ADR-066): `mgPerMl` é a razão normalizada (dosage_per_pill) e
 * `volumeMl` é o denominador do rótulo (`concentration_volume_ml`; NULL/omitido = 1 mL).
 * amount = mgPerMl × volume. Mounjaro (razão 5, volume 0,5) → "2,5 mg em 0,5 mL";
 * caso comum (volume 1) → "X mg em 1 mL" (compatível com a Fase B2). Vírgula PT-BR.
 * Retorna '' se a razão for inválida.
 *
 * @param {number|string|null} mgPerMl - razão mg/mL (dosage_per_pill)
 * @param {number|string|null} [volumeMl=1] - volume do rótulo (concentration_volume_ml)
 * @returns {string}
 * @example formatConcentrationLabel(0.68)      → '0,68 mg em 1 mL'
 * @example formatConcentrationLabel(5, 0.5)    → '2,5 mg em 0,5 mL'
 * @example formatConcentrationLabel(null)      → ''
 */
export function formatConcentrationLabel(mgPerMl: number | string | null, volumeMl: number | string = 1) {
  const ratio = Number(typeof mgPerMl === 'string' ? mgPerMl.replace(',', '.') : mgPerMl)
  if (!Number.isFinite(ratio) || ratio <= 0) return ''
  const volNum = Number(typeof volumeMl === 'string' ? volumeMl.replace(',', '.') : volumeMl)
  const vol = Number.isFinite(volNum) && volNum > 0 ? volNum : 1
  const amount = cleanFloat(ratio * vol)
  return `${formatNumberPtBR(amount)} mg em ${formatNumberPtBR(vol)} mL`
}

/**
 * Rendimento de estoque em APLICAÇÕES (012 Fase B2, FR-020): o lote é guardado em
 * ml, mas o usuário pensa em "quantas aplicações/canetas restam". Floor (nunca
 * arredonda p/ cima — overfill da caneta não é dose disponível). Container rotula
 * a unidade (caneta/ampola/...); fallback "aplicação". Sem dose-por-aplicação
 * válida (0/NULL), retorna o saldo cru em ml (não inventa contagem).
 *
 * @param {number|string} mlRemaining - saldo do estoque em ml
 * @param {number|string} mlPerApplication - ml por aplicação (dose_mg / units_per_ml)
 * @param {string|null} containerSingular - rótulo singular (de INJECTION_CONTAINER_SINGULAR) ou null
 * @returns {string}
 * @example formatStockApplications(10, 0.37, 'caneta') → '≈ 27 canetas'
 * @example formatStockApplications(1.5, 0.37, null)    → '≈ 4 aplicações'
 * @example formatStockApplications(10, 0, 'caneta')    → '10 ml'
 */
export function formatStockApplications(
  mlRemaining: number | string,
  mlPerApplication: number | string,
  containerSingular: string | null
): string {
  const ml = Number(typeof mlRemaining === 'string' ? mlRemaining.replace(',', '.') : mlRemaining)
  const perApp = Number(
    typeof mlPerApplication === 'string' ? mlPerApplication.replace(',', '.') : mlPerApplication
  )
  if (!Number.isFinite(ml) || ml < 0) return ''
  // Sem ml-por-aplicação válido: não dá p/ contar aplicações — mostra saldo cru.
  if (!Number.isFinite(perApp) || perApp <= 0) return formatDose(ml, 'ml')
  const count = Math.floor(ml / perApp)
  const label = containerSingular || 'aplicação'
  const plural = count === 1 ? label : pluralizeContainer(label)
  return `≈ ${count} ${plural}`
}

/**
 * Plural simples de rótulos de container PT-BR (caneta→canetas, frasco→frascos,
 * aplicação→aplicações). Regra mínima: termina em vogal → +s; em 'ão' → 'ões'.
 */
function pluralizeContainer(singular: string): string {
  if (singular.endsWith('ão')) return `${singular.slice(0, -2)}ões`
  return `${singular}s`
}

/**
 * Retorna "unidade" (singular) ou "unidades" (plural) baseado na quantidade.
 * Coerce explícito via Number — valores podem chegar como string de TextInput.
 *
 * @example pluralizeDoseUnit(1)   → 'unidade'
 * @example pluralizeDoseUnit(2)   → 'unidades'
 * @example pluralizeDoseUnit(0.5) → 'unidades'
 * @example pluralizeDoseUnit('1') → 'unidade'
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura legada (2º arg ignorado)
export function pluralizeDoseUnit(qty: number | string, _legacyUnit?: string): string {
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
export function formatNumberPtBR(num: number | string | null | undefined): string {
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
export function formatDoseUnit(qty: number | string): string {
  const display = formatNumberPtBR(qty)
  return `${display} ${pluralizeDoseUnit(qty)}`
}

/**
 * Formata dose na UNIDADE DE TOMADA real (líquidos — 022). Vírgula decimal PT-BR
 * (reusa formatNumberPtBR). `gotas` tem singular/plural próprio; `pluralizeDoseUnit`
 * só serve p/ "unidade(s)", por isso o plural de gotas é inline.
 *
 * @example formatDose(15, 'gotas') → '15 gotas'
 * @example formatDose(1, 'gotas')  → '1 gota'
 * @example formatDose(2.5, 'ml')   → '2,5 ml'
 * @example formatDose(10, 'UI')    → '10 UI'
 * @example formatDose(null, 'ml')  → ''
 */
export function formatDose(value: number | string | null | undefined, unit: string | null | undefined): string {
  if (value === undefined || value === null) return ''
  const v = formatNumberPtBR(value)
  if (v === '') return ''
  if (unit === 'ml') return `${v} ml`
  if (unit === 'gotas') {
    // Normaliza vírgula PT-BR ('1,0') antes do check de singular — senão Number('1,0')=NaN
    // exibiria '1 gotas' (review #651).
    const numVal = Number(typeof value === 'string' ? value.replace(',', '.') : value)
    return `${v} ${numVal === 1 ? 'gota' : 'gotas'}`
  }
  if (unit === 'UI') return `${v} UI`
  return `${v} ${unit || ''}`.trim()
}

/**
 * Formata a dose de UMA tomada para exibição em cards/detalhe (022).
 * Líquido (medicine.dosage_unit termina em '/ml'): mostra a unidade de tomada
 * (gotas/ml/UI) + equivalência em ml quando não-ml. Sólido: cai no hint de
 * princípio ativo. Centraliza a lógica antes duplicada em telas (evita drift).
 *
 * @param {number|string} qty - dose por tomada (na unidade de tomada)
 * @param {string|null} intakeUnit - 'gotas' | 'ml' | 'UI' | null
 * @param {Object|null} medicine - { dosage_unit, dosage_per_pill, units_per_ml }
 * @returns {string}
 * @example formatIntakeDose(40,'gotas',{dosage_unit:'mg/ml',units_per_ml:20}) → '40 gotas (≈ 2 ml)'
 * @example formatIntakeDose(100,'UI',{dosage_unit:'ui/ml',units_per_ml:100})  → '100 UI (≈ 1 ml)'
 * @example formatIntakeDose(5,'ml',{dosage_unit:'mg/ml'})                      → '5 ml'
 */
/**
 * Densidade (unidades por mL) para converter gotas/UI → mL, **unit-aware** (012 Fase B3,
 * ADR-065). Substitui o fallback blanket 20: a densidade explícita (`units_per_ml`) tem
 * prioridade; faltando, o padrão depende da UNIDADE DE TOMADA — gotas≈20/mL (conta-gotas
 * universal), UI≈100/mL (U-100). Sem valor e sem padrão seguro → `null` (o caller decide:
 * erro explícito ou sem conversão — Const. IX, não chuta dose). mg NÃO usa isto (usa
 * `dosage_per_pill`); ml é dose direta.
 *
 * @param {string|null} intakeUnit - 'gotas' | 'UI' | 'ml' | 'mg'
 * @param {number|string|null} unitsPerMl - densidade explícita do cadastro
 * @returns {number|null} densidade a aplicar, ou null se indefinível
 */
export function densityFor(intakeUnit: string | null | undefined, unitsPerMl: number | string | null | undefined): number | null {
  const explicit = Number(typeof unitsPerMl === 'string' ? unitsPerMl.replace(',', '.') : unitsPerMl)
  if (explicit > 0) return explicit
  switch ((intakeUnit || '').toLowerCase()) {
    case 'gotas': return 20
    case 'ui': return 100
    default: return null
  }
}

export function formatIntakeDose(qty: number | string, intakeUnit: string | null | undefined, medicine: MedicineLike | null | undefined): string {
  const isLiquid = Boolean(medicine?.dosage_unit?.endsWith('/ml'))
  if (!isLiquid) {
    return (
      formatActiveIngredientHint(qty, medicine?.dosage_per_pill, medicine?.dosage_unit) ||
      `${qty} un.`
    )
  }
  const intake = intakeUnit || 'ml'
  const base = formatDose(qty, intake)
  if (intake === 'ml') return base
  const numQty = Number(typeof qty === 'string' ? qty.replace(',', '.') : qty)
  // mg → ml: divide pela CONCENTRAÇÃO (dosage_per_pill = mg por ml; já no cadastro).
  // gotas/UI → ml: divide pela razão física units_per_ml (fallback 20).
  // São campos distintos (012 Fase B2): mg não usa units_per_ml.
  // mg → concentração (dosage_per_pill); gotas/UI → densidade unit-aware (ADR-065).
  const divisor =
    intake === 'mg'
      ? Number(medicine?.dosage_per_pill) > 0
        ? Number(medicine?.dosage_per_pill)
        : null
      : densityFor(intake, medicine?.units_per_ml)
  if (!divisor) return base // sem concentração/densidade não há como exibir ≈ml
  // Arredonda a 2 casas — sem isso, mg ÷ concentração gera dízima ("0,3676 ml").
  const ml = Math.round((numQty / divisor) * 100) / 100
  return `${base} (≈ ${formatDose(ml, 'ml')})`
}

/**
 * Hint de dose para formulários (✨ Equivale a…). Líquido → unidade de tomada +
 * ≈ml (formatIntakeDose); sólido → equivalência de princípio ativo. Centraliza o
 * que era formatActiveIngredientFormula cru (só-sólido) nos forms de tratamento.
 *
 * @param {number|string} qty - dose por tomada
 * @param {string|null} intakeUnit - gotas|ml|UI (líquidos)
 * @param {{dosage_unit?: string, dosage_per_pill?: number, units_per_ml?: number}|null} medicine
 * @returns {string}
 */
export function formatDoseHint(qty: number | string, intakeUnit: string | null | undefined, medicine: MedicineLike | null | undefined): string {
  if (isLiquidMedicine(medicine)) return formatIntakeDose(qty, intakeUnit, medicine)
  return formatActiveIngredientFormula(qty, medicine?.dosage_per_pill, medicine?.dosage_unit)
}

/**
 * Atalho p/ a shape camelCase do DoseItem (doseZones) e cards do dashboard/web.
 * Converte para o contrato de formatIntakeDose. Centraliza a exibição de dose
 * (líquido na unidade de tomada + ≈ml; sólido com hint) entre web e mobile.
 *
 * @param {{dosagePerIntake?: number, intakeUnit?: string|null, dosageUnit?: string|null, dosagePerPill?: number|null, unitsPerMl?: number|null}} item
 * @returns {string}
 */
export function formatDoseItem(item: DoseItemLike | null | undefined): string {
  if (!item) return ''
  return formatIntakeDose(item.dosagePerIntake ?? 1, item.intakeUnit, {
    dosage_unit: item.dosageUnit,
    dosage_per_pill: item.dosagePerPill,
    units_per_ml: item.unitsPerMl,
  })
}

/**
 * Retorna apenas o valor de concentração do princípio ativo correspondente.
 * Usado para hints em linhas separadas (como nos indicadores do Estoque).
 *
 * @example formatActiveIngredientShort(2, 600, 'mg')   → '1.200 mg'
 * @example formatActiveIngredientShort(1.5, 100, 'ui')  → '150 UI'
 * @example formatActiveIngredientShort(3, 1, 'gotas')  → ''
 */
function convertMetricUnit(total: number, unit: string | null | undefined): { total: number; currentUnit: string | null | undefined } {
  if (total >= 5000) {
    if (unit === 'mcg') return { total: total / 1000, currentUnit: 'mg' }
    if (unit === 'mg') return { total: total / 1000, currentUnit: 'g' }
    if (unit === 'g') return { total: total / 1000, currentUnit: 'kg' }
    if (unit === 'ml') return { total: total / 1000, currentUnit: 'l' }
  }
  return { total, currentUnit: unit }
}

export function formatActiveIngredientShort(qty: number | string | null | undefined, dosagePerPill: number | string | null | undefined, unit: string | null | undefined): string {
  // Vírgula decimal PT-BR normalizada nos DOIS parâmetros (review Gemini #731):
  // Number('0,5') = NaN, e NaN <= 0 é false — passaria no guard e vazaria '' no chip.
  const dosagePerPillNum = dosagePerPill == null ? NaN : Number(String(dosagePerPill).replace(',', '.'))
  if (
    qty == null ||
    qty === '' ||
    isNaN(Number(String(qty).replace(',', '.'))) ||
    isNaN(dosagePerPillNum) ||
    dosagePerPillNum <= 0
  ) {
    return ''
  }
  const qtyNum = Number(String(qty).replace(',', '.'))
  // cleanFloat no produto (R-277): formatNumberPtBR não arredonda, então o artefato
  // de float (1,5×0,1=0,15000000000000002) vazaria pro chip de estoque (AP-226).
  const { total, currentUnit } = convertMetricUnit(cleanFloat(qtyNum * dosagePerPillNum), unit)

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

  const displayTotalUnit = (currentUnit && totalUnitLabels[currentUnit as keyof typeof totalUnitLabels]) || currentUnit || ''

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
export function formatActiveIngredientHint(qty: number | string | null | undefined, dosagePerPill: number | string | null | undefined, unit: string | null | undefined): string {
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

  const displayUnit = (unit && unitLabels[unit as keyof typeof unitLabels]) || 'un.'

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
export function formatActiveIngredientFormula(qty: number | string | null | undefined, dosagePerPill: number | string | null | undefined, unit: string | null | undefined): string {
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

  const displayUnit = (unit && unitLabels[unit as keyof typeof unitLabels]) || 'un.'

  if ((unit === 'un' || unit === 'gotas') && (dosagePerPill == null || dosagePerPill === 1)) {
    return `Equivale a ${displayQty} ${displayUnit}`
  }

  const shortVal = formatActiveIngredientShort(qty, dosagePerPill, unit)
  if (!shortVal) {
    return `Equivale a ${displayQty} ${displayUnit}`
  }

  return `Equivale a ${shortVal}`
}


