/**
 * Converte texto para Sentence Case (primeira letra maiúscula, resto minúscula)
 * @param {string} str - Texto a converter
 * @returns {string} Texto convertido ou string vazia
 */
export const toSentenceCase = (str) => {
  if (!str) return ''
  const lower = str.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * Converte texto para Title Case (primeira letra de cada palavra maiúscula)
 * Exemplos:
 *   "dipirona 500mg" → "Dipirona 500mg"
 *   "vitamina c" → "Vitamina C"
 *   "ácido acetilsalicílico" → "Ácido Acetilsalicílico"
 *
 * @param {string} str - Texto a converter
 * @returns {string} Texto em Title Case ou string vazia
 */
export const toTitleCase = (str) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
