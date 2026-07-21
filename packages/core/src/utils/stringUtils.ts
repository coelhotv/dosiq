/**
 * Converte texto para Sentence Case (primeira letra maiúscula, resto minúscula)
 * @param {string} str - Texto a converter
 * @returns {string} Texto convertido ou string vazia
 */
export const toSentenceCase = (str: string): string => {
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
export const toTitleCase = (str: string): string => {
  if (!str) return ''
  const lower = str.toLowerCase()
  const exceptions = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'em', 'para', 'por'])
  return lower
    .split(/\s+/)
    .map((word: string, index: number) => {
      if (index > 0 && exceptions.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Rótulo de quantidade de dias, com plural correto.
 *
 * Existe para não repetir `${n} ${n === 1 ? 'dia' : 'dias'}` em cada call site. Achado no RC6
 * do 029 F6: ao remover o `formatDaysRemaining` do `titrationService` web (que morreu com o
 * modelo N1), a pluralização foi inlinada em 4 lugares novos — é a família do AP-306, em que
 * o rótulo montado no call site diverge com o tempo e o JSDoc vira ficção.
 *
 * Não formata "restantes"/"em X" de propósito: a preposição muda com a frase ("próxima em 3
 * dias", "há 3 dias", "3 dias"), e embutir isso aqui obrigaria uma variante por frase.
 *
 * @example formatDaysLabel(1)  → '1 dia'
 * @example formatDaysLabel(3)  → '3 dias'
 * @example formatDaysLabel(0)  → '0 dias'
 */
export const formatDaysLabel = (days: number | null | undefined): string => {
  const n = Number(days)
  if (!Number.isFinite(n)) return ''
  return `${n} ${n === 1 ? 'dia' : 'dias'}`
}
