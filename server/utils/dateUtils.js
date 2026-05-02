/* eslint-disable no-restricted-syntax */

/**
 * Date Utilities - Funções utilitárias para manipulação de datas no Servidor
 * Ancorado no fuso horário de Brasília (GMT-3).
 */

/**
 * Retorna um objeto Date "ajustado" para o fuso de São Paulo
 * para facilitar extração de horas/minutos locais em ambientes UTC.
 * @param {Date|string} [date] - Data base (default: agora)
 * @returns {Date}
 */
export function getSaoPauloTime(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }));
}

/**
 * Retorna a data/hora atual como objeto Date ancorado em SP
 * @returns {Date}
 */
export function getNow() {
  return getSaoPauloTime();
}

/**
 * Converte string de data (YYYY-MM-DD) para Date em timezone local (SP)
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {Date} Date object em timezone local (meia-noite local de SP)
 */
export function parseLocalDate(dateStr) {
  // O sufixo T00:00:00 sem Z ou fuso garante que o JS entenda como tempo local
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Formata Date para string YYYY-MM-DD em fuso SP
 * @param {Date} [date] - Date object
 * @returns {string} Data no formato YYYY-MM-DD
 */
export function getTodayLocal(date = getNow()) {
  // R-020: Como date já é shifted para SP via getNow/getSaoPauloTime, 
  // o toISOString reflete o "tempo de parede" de SP.
  return date.toISOString().split('T')[0];
}

/**
 * Retorna o timestamp atual em formato ISO (UTC)
 * Útil para logs de sistema e salvamento no banco (timestamptz).
 * @returns {string} ISO 8601 string
 */
export function getServerTimestamp() {
  return new Date().toISOString();
}

/**
 * Adiciona dias a uma data.
 * @param {Date|string} date 
 * @param {number} days 
 * @returns {Date}
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Adiciona horas a uma data (ou a partir de agora)
 * @param {number} hours - Horas a adicionar
 * @param {Date} [date] - Data base (opcional, default: agora)
 * @returns {Date} Nova data
 */
export function addHours(hours, date = getNow()) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Adiciona minutos a uma data
 * @param {number} minutes 
 * @param {Date} [date] 
 * @returns {Date}
 */
export function addMinutes(minutes, date = getNow()) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Converte string ISO para objeto Date
 * @param {string} isoString 
 * @returns {Date}
 */
export function parseISO(isoString) {
  return new Date(isoString);
}

/**
 * Retorna o horário atual formatado para HH:mm (fuso SP).
 * @returns {string}
 */
export function getCurrentTime() {
  // R-020: date já é shifted, toISOString reflete tempo de parede de SP
  return getNow().toISOString().slice(11, 16);
}

/**
 * Retorna o ISO UTC correspondente ao início do dia (00:00:00) em São Paulo.
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {string} ISO 8601 string (UTC)
 */
export function getStartOfDayISO(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const spHour = parseInt(d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }), 10);
  const offset = spHour >= 12 ? spHour - 24 : spHour;
  return new Date(d.getTime() - offset * 60 * 60 * 1000).toISOString();
}

/**
 * Retorna o ISO UTC correspondente ao fim do dia (23:59:59.999) em São Paulo.
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {string} ISO 8601 string (UTC)
 */
export function getEndOfDayISO(dateStr) {
  const start = new Date(getStartOfDayISO(dateStr));
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}
