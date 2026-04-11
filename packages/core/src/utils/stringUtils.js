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
  const lower = str.toLowerCase()
  const exceptions = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'em', 'para', 'por'])
  return lower
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && exceptions.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}
