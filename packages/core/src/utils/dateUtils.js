/* eslint-disable no-restricted-syntax */
/**
 * Date Utilities - Funções utilitárias para manipulação de datas
 *
 * IMPORTANTE: Todas as funções usam timezone local (GMT-3 para Brasil).
 * Nunca usar new Date('YYYY-MM-DD') diretamente, pois isso cria data em UTC.
 *
 * @module dateUtils
 */

/**
 * Converte string de data (YYYY-MM-DD) para Date em timezone local
 * Isso evita o problema de new Date('2024-01-01') criar data em UTC (meia-noite UTC)
 * que pode aparecer como dia anterior em GMT-3.
 *
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

/**
 * Verifica se um protocolo estava ativo em uma data específica.
 * Considera start_date e end_date do protocolo.
 *
 * @param {Object} protocol - Protocolo com start_date e end_date (strings YYYY-MM-DD)
 * @param {string|Date} date - Data a verificar (string YYYY-MM-DD ou Date object)
 * @returns {boolean} True se o protocolo estava ativo na data
 */
export function isProtocolActiveOnDate(protocol, date) {
  // Converte para Date em timezone local
  const currentDate = typeof date === 'string' ? parseLocalDate(date) : date

  // Verificar se o protocolo já começou
  if (protocol.start_date) {
    const startDate = parseLocalDate(protocol.start_date)
    if (currentDate < startDate) return false
  }

  // Verificar se o protocolo já terminou
  // Nota: end_date é inclusivo, então comparamos com T23:59:59
  if (protocol.end_date) {
    const endDate = new Date(protocol.end_date + 'T23:59:59')
    if (currentDate > endDate) return false
  }

  return true
}

/**
 * Retorna a data de hoje formatada como YYYY-MM-DD em timezone local
 * @returns {string} Data de hoje no formato YYYY-MM-DD
 */
export function getTodayLocal() {
  return formatLocalDate(getSaoPauloTime())
}

/**
 * Retorna a data de ontem formatada como YYYY-MM-DD em timezone local
 * @returns {string} Data de ontem no formato YYYY-MM-DD
 */
export function getYesterdayLocal() {
  const yesterday = getSaoPauloTime()
  yesterday.setDate(yesterday.getDate() - 1)
  return formatLocalDate(yesterday)
}

/**
 * Adiciona dias a uma data e retorna em timezone local
 * @param {Date|string} date - Data base (Date object ou string YYYY-MM-DD)
 * @param {number} days - Número de dias a adicionar (pode ser negativo)
 * @returns {Date} Nova data em timezone local
 */
export function addDays(date, days) {
  const baseDate = typeof date === 'string' ? parseLocalDate(date) : new Date(date)
  baseDate.setDate(baseDate.getDate() + days)
  return baseDate
}

/**
 * Calcula a diferença em dias entre duas datas
 * @param {Date|string} date1 - Primeira data
 * @param {Date|string} date2 - Segunda data
 * @returns {number} Diferença em dias (positivo se date2 > date1)
 */
export function daysDifference(date1, date2) {
  const d1 = typeof date1 === 'string' ? parseLocalDate(date1) : date1
  const d2 = typeof date2 === 'string' ? parseLocalDate(date2) : date2
  const diffTime = d2.getTime() - d1.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
/**
 * Retorna o nome do período/turno baseado no horário HH:mm
 * @param {string} timeStr - Horário no formato HH:mm
 * @returns {'Madrugada'|'Manhã'|'Tarde'|'Noite'}
 */
export function getPeriodFromTime(timeStr) {
  if (!timeStr) return 'Manhã'
  const [h] = timeStr.split(':').map(Number)
  if (h >= 5 && h < 12) return 'Manhã'
  if (h >= 12 && h < 18) return 'Tarde'
  if (h >= 18 && h <= 23) return 'Noite'
  return 'Madrugada'
}

/**
 * Retorna a data/hora atual como objeto Date
 * @returns {Date}
 */
export function getNow() {
  return getSaoPauloTime()
}

/**
 * Retorna o timestamp atual em formato ISO (UTC)
 * @returns {string} ISO 8601 string
 */
export function getServerTimestamp() {
  return new Date().toISOString()
}

/**
 * Converte string ISO para objeto Date
 * @param {string} isoString 
 * @returns {Date}
 */
export function parseISO(isoString) {
  return new Date(isoString)
}

/**
 * Retorna o ISO UTC correspondente ao início do dia (00:00:00) em São Paulo.
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {string} ISO 8601 string (UTC)
 */
export function getStartOfDayISO(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  // Descobrir o offset de SP para esta data específica
  const spHour = parseInt(
    d.toLocaleString('en-CA', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }),
    10
  )
  const offset = spHour >= 12 ? spHour - 24 : spHour
  return new Date(d.getTime() - offset * 60 * 60 * 1000).toISOString()
}

/**
 * Retorna o ISO UTC correspondente ao fim do dia (23:59:59.999) em São Paulo.
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {string} ISO 8601 string (UTC)
 */
export function getEndOfDayISO(dateStr) {
  const start = new Date(getStartOfDayISO(dateStr))
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
}

/**
 * Retorna um objeto Date "ajustado" para o fuso de São Paulo
 * para facilitar extração de horas/minutos locais em ambientes UTC.
 * @param {Date} [date] - Data base (default: agora)
 * @returns {Date}
 */
export function getSaoPauloTime(date = new Date()) {
  return new Date(
    date.toLocaleString('en-CA', {
      timeZone: 'America/Sao_Paulo',
      hour12: false,
    }).replace(', ', 'T')
  )
}

/**
 * Clona um objeto Date para evitar mutações.
 * @param {Date} date 
 * @returns {Date}
 */
export function cloneDate(date) {
  return new Date(date.getTime())
}

/**
 * Adiciona meses a uma data e retorna um novo objeto Date.
 * @param {Date|string} date - Data base (Date object ou string YYYY-MM-DD)
 * @param {number} months - Número de meses a adicionar (pode ser negativo)
 * @returns {Date} Nova data
 */
export function addMonths(date, months) {
  const baseDate = typeof date === 'string' ? parseLocalDate(date) : cloneDate(date)
  baseDate.setDate(1) // Seta dia 1 para evitar problemas com meses curtos
  baseDate.setMonth(baseDate.getMonth() + months)
  return baseDate
}
