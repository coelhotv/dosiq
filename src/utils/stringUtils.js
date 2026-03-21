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
