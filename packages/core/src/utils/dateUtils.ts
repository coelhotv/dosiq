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
 * Retorna a data de hoje formatada como YYYY-MM-DD no fuso informado.
 * @param {string} [tz='America/Sao_Paulo'] - Timezone IANA opcional (default São Paulo)
 * @returns {string} Data de hoje no formato YYYY-MM-DD
 */
export function getTodayLocal(tz = 'America/Sao_Paulo') {
  return formatLocalDate(getUserTime(new Date(), tz))
}

/**
 * Retorna a data de ontem formatada como YYYY-MM-DD no fuso informado.
 * @param {string} [tz='America/Sao_Paulo'] - Timezone IANA opcional (default São Paulo)
 * @returns {string} Data de ontem no formato YYYY-MM-DD
 */
export function getYesterdayLocal(tz = 'America/Sao_Paulo') {
  const yesterday = getUserTime(new Date(), tz)
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
 * Retorna a data/hora atual como objeto Date no fuso informado.
 * @param {string} [tz='America/Sao_Paulo'] - Timezone IANA opcional (default São Paulo)
 * @returns {Date}
 */
export function getNow(tz = 'America/Sao_Paulo') {
  return getUserTime(new Date(), tz)
}

/**
 * Retorna a data/hora atual "bruta" (sem ajuste de fuso horário).
 * Útil para timers e momentos que serão processados por outras funções de fuso.
 * @returns {Date}
 */
export function getRawNow() {
  return new Date()
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
 * Retorna o ISO UTC correspondente ao início do dia (00:00:00) no fuso informado.
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @param {string} [tz='America/Sao_Paulo'] - Timezone IANA opcional (default São Paulo)
 * @returns {string} ISO 8601 string (UTC)
 */
export function getStartOfDayISO(dateStr, tz = 'America/Sao_Paulo') {
  const d = new Date(dateStr + 'T00:00:00Z')
  // Descobrir o offset do fuso para esta data específica.
  // Reusa getUserTime (Intl.DateTimeFormat + formatToParts) em vez de
  // toLocaleString('en-CA', hour12:false), que pode retornar AM/PM em
  // engines sem ICU completo (Hermes/RN, navegadores antigos) — AP-155/R-199.
  const spHour = getUserTime(d, tz).getHours()
  const offset = spHour >= 12 ? spHour - 24 : spHour
  return new Date(d.getTime() - offset * 60 * 60 * 1000).toISOString()
}

/**
 * Retorna o ISO UTC correspondente ao fim do dia (23:59:59.999) no fuso informado.
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @param {string} [tz='America/Sao_Paulo'] - Timezone IANA opcional (default São Paulo)
 * @returns {string} ISO 8601 string (UTC)
 */
export function getEndOfDayISO(dateStr, tz = 'America/Sao_Paulo') {
  const start = new Date(getStartOfDayISO(dateStr, tz))
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
}

/**
 * Retorna um objeto Date "ajustado" para o fuso informado (default São Paulo)
 * para facilitar extração de horas/minutos locais em ambientes UTC.
 *
 * O Date retornado terá os mesmos valores de getHours(), getMinutes(), etc.
 * que um relógio no fuso informado mostraria naquele momento.
 *
 * @param {Date} [date] - Data base (default: agora)
 * @param {string} [tz='America/Sao_Paulo'] - Timezone IANA (ex: 'America/New_York')
 * @returns {Date}
 */
export function getUserTime(date = new Date(), tz = 'America/Sao_Paulo') {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const map: Record<string, string> = {}
  parts.forEach(p => { map[p.type] = p.value })

  // Construir string ISO simplificada para as partes do fuso
  // Ao criar o Date sem timezone, ele usa o timezone local da máquina (ex: UTC no CI)
  // mas preserva os números do fuso, garantindo que getHours() retorne o valor esperado.
  const isoStr = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`
  const result = new Date(isoStr)

  // Garantir preservação de milissegundos se disponíveis
  if (!isNaN(result.getTime())) {
    result.setMilliseconds(date.getMilliseconds())
  }

  return result
}

/**
 * Retorna um objeto Date "ajustado" para o fuso de São Paulo
 * para facilitar extração de horas/minutos locais em ambientes UTC.
 *
 * Wrapper retrocompatível de getUserTime (default 'America/Sao_Paulo').
 *
 * O Date retornado terá os mesmos valores de getHours(), getMinutes(), etc.
 * que um relógio em São Paulo mostraria naquele momento.
 *
 * @param {Date} [date] - Data base (default: agora)
 * @returns {Date}
 */
export function getSaoPauloTime(date = new Date()) {
  return getUserTime(date, 'America/Sao_Paulo')
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

/**
 * Retorna o último dia de um determinado mês/ano.
 * @param {number} year 
 * @param {number} month - 0-11
 * @returns {number}
 */
export function getLastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/**
 * Converte string datetime-local (YYYY-MM-DDTHH:mm) para objeto Date no fuso de SP.
 * @param {string} datetimeStr 
 * @returns {Date}
 */
export function parseLocalDatetime(datetimeStr) {
  if (!datetimeStr) return getNow()
  // Adiciona segundos e offset de Brasília se não houver
  const fullStr = datetimeStr.length === 16 ? `${datetimeStr}:00-03:00` : datetimeStr
  return new Date(fullStr)
}

/**
 * Converte timestamp numérico (ms) para objeto Date.
 * @param {number|string} timestamp 
 * @returns {Date}
 */
export function parseTimestamp(timestamp) {
  if (!timestamp) return getNow()
  return new Date(Number(timestamp))
}
