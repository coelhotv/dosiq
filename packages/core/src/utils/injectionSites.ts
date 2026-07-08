/**
 * injectionSites — Sítios corporais de aplicação de injetáveis (spec 031)
 *
 * Núcleo compartilhado web↔mobile (mesmo padrão de `doseZones`): lista canônica dos
 * locais de aplicação (região + laterália E/D) com labels PT e hint educacional de
 * absorção. Domínio FINITO e estável (8 sítios) — sincronizado com o CHECK
 * `medicine_logs_injection_site_check` (R-082/R-271, ADR-072).
 *
 * NÃO confundir com `doseZones` (zonas de HORÁRIO do dia). Aqui são regiões CORPORAIS.
 *
 * SaMD: `absorption` é texto EDUCACIONAL (informativo), nunca recomendação/prescrição
 * de sítio (ADR-062/ADR-072 — "sugerir próximo sítio" fica fora de escopo).
 *
 * @module injectionSites
 */

/**
 * @typedef {Object} InjectionSite
 * @property {string} value - chave canônica persistida (snake_case, caixa exata do CHECK)
 * @property {string} label - rótulo PT exibido (região + lado)
 * @property {string} absorption - hint educacional de ritmo de absorção (não-SaMD)
 */

/** Lista canônica dos 8 sítios (ordem de exibição). Fonte única web↔mobile. */
export const INJECTION_SITES = [
  { value: 'abdomen_e', label: 'Abdômen (esquerdo)', absorption: 'absorção mais rápida' },
  { value: 'abdomen_d', label: 'Abdômen (direito)', absorption: 'absorção mais rápida' },
  { value: 'braco_e', label: 'Braço (esquerdo)', absorption: 'absorção moderada' },
  { value: 'braco_d', label: 'Braço (direito)', absorption: 'absorção moderada' },
  { value: 'coxa_e', label: 'Coxa (esquerda)', absorption: 'absorção mais lenta' },
  { value: 'coxa_d', label: 'Coxa (direita)', absorption: 'absorção mais lenta' },
  { value: 'gluteo_e', label: 'Glúteo (esquerdo)', absorption: 'absorção mais lenta' },
  { value: 'gluteo_d', label: 'Glúteo (direito)', absorption: 'absorção mais lenta' },
]

/** Valores canônicos (p/ enum Zod e teste de paridade com o CHECK SQL). */
export const INJECTION_SITE_VALUES = INJECTION_SITES.map((s) => s.value)

/** Mapa value→label (lookup O(1) na UI/histórico). */
const SITE_LABELS = Object.fromEntries(INJECTION_SITES.map((s) => [s.value, s.label]))

/** Mapa value→absorption (hint educacional). */
const SITE_ABSORPTION = Object.fromEntries(INJECTION_SITES.map((s) => [s.value, s.absorption]))

/**
 * Rótulo PT de um sítio. Degrada no próprio valor quando desconhecido (legado/futuro),
 * nunca lança — segue o padrão de `doseZones` (helper de label tolerante).
 * @param {string|null|undefined} value
 * @returns {string|null} label PT, ou null quando value é vazio/null
 */
export function getInjectionSiteLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return SITE_LABELS[value] ?? value
}

/**
 * Hint educacional de absorção de um sítio (não-SaMD). null quando vazio/desconhecido.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function getInjectionSiteAbsorption(value: string | null | undefined): string | null {
  if (!value) return null
  return SITE_ABSORPTION[value] ?? null
}

/**
 * Detecta se um medicamento é injetável (campo de sítio só aparece p/ injetáveis).
 * Baseado em `presentation === 'injetavel'` (PRESENTATIONS, medicineSchema) — NÃO em
 * `type` (que é ['medicamento','suplemento'], sem 'injetavel').
 * @param {{ presentation?: string|null }|null|undefined} medicine
 * @returns {boolean}
 */
export function isInjectable(medicine: { presentation?: string | null } | null | undefined): boolean {
  return medicine?.presentation === 'injetavel'
}
