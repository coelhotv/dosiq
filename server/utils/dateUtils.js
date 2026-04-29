/**
 * Date Utilities - Funções utilitárias para manipulação de datas no Servidor
 */

/**
 * Converte string de data (YYYY-MM-DD) para Date em timezone local
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {Date} Date object em timezone local (meia-noite local)
 */
export function parseLocalDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

/**
 * Formata Date para string YYYY-MM-DD em timezone local
 * @param {Date} date - Date object
 * @returns {string} Data no formato YYYY-MM-DD
 */
export function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
