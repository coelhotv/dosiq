// biomarkerDisplay.js — formatação de medidas de biomarcador (spec 032).
// Fonte única web↔mobile (consolida 4 cópias locais de `formatMeasure` da Fase C).
// SaMD (ADR-062): só formata valor — nenhuma classificação/qualidade.

import {
  BIOMARKER_CONTEXT_LABELS,
  BIOMARKER_PA_CONTEXT_LABELS,
  BIOMARKER_TYPE_LABELS,
  BIOMARKER_TYPE_SHORT_LABELS,
} from '../schemas/biomarkerLogSchema.js'

// Número PT-BR (ponto → vírgula). Não força casas decimais.
function ptBR(n) {
  return String(n).replace('.', ',')
}

/**
 * Formata o valor de uma medida.
 *  - Composta (PA, com `value_secondary`): "120 por 80 mmHg"
 *  - Simples (glicemia/peso/...): "120 mg/dL"
 *
 * @param {{value:number, value_secondary?:number|null, unit:string}} item
 * @returns {string}
 */
export function formatBiomarkerDisplay(item) {
  if (!item || item.value == null) return ''
  const v = ptBR(item.value)
  if (item.value_secondary != null) {
    return `${v} por ${ptBR(item.value_secondary)} ${item.unit}`
  }
  return `${v} ${item.unit}`
}

/**
 * Resolve o rótulo PT-BR de um contexto, de qualquer família.
 * Degrada com elegância em valor desconhecido (DB livre pós-ADR-070) → retorna null (oculta).
 *
 * @param {string|null|undefined} context
 * @returns {string|null}
 */
export function formatBiomarkerContext(context) {
  if (!context) return null
  return BIOMARKER_CONTEXT_LABELS[context] ?? BIOMARKER_PA_CONTEXT_LABELS[context] ?? null
}

/**
 * Rótulo do tipo para CARDS (curto quando existir; "Pressão" no lugar de "Pressão arterial").
 * Seletores/chips devem usar BIOMARKER_TYPE_LABELS (completo).
 *
 * @param {string} type
 * @returns {string}
 */
export function biomarkerCardLabel(type) {
  return BIOMARKER_TYPE_SHORT_LABELS[type] ?? BIOMARKER_TYPE_LABELS[type] ?? type
}
