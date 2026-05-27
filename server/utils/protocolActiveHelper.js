import { parseLocalDate, getTodayLocal } from './dateUtils.js';

const WEEKDAY_INDEX_MAP = {
  domingo: 0, sunday: 0,
  segunda: 1, 'segunda-feira': 1, monday: 1,
  terça: 2, 'terça-feira': 2, tuesday: 2,
  quarta: 3, 'quarta-feira': 3, wednesday: 3,
  quinta: 4, 'quinta-feira': 4, thursday: 4,
  sexta: 5, 'sexta-feira': 5, friday: 5,
  sábado: 6, sabado: 6, saturday: 6,
};

/**
 * Obtém os dias ativos do protocolo de forma retrocompatível,
 * tratando corretamente o fato de que arrays vazios '[]' em JS são truthy.
 * @param {Object} protocol - O objeto do protocolo
 * @returns {string[]} Array com os dias da semana ativos
 */
export function getProtocolDays(protocol) {
  if (!protocol) return [];
  if (Array.isArray(protocol.weekdays) && protocol.weekdays.length > 0) {
    return protocol.weekdays;
  }
  if (Array.isArray(protocol.days) && protocol.days.length > 0) {
    return protocol.days;
  }
  return [];
}

/**
 * Determina se um protocolo é ativo em um determinado dia da semana e data.
 * Puramente implementado no servidor para consistência de pushes, relatórios e bot.
 * 
 * @param {Object} protocol - Objeto do protocolo com frequency, weekdays, days, start_date, etc.
 * @param {number} weekdayIndex - Índice do dia da semana (0=Domingo..6=Sábado)
 * @param {string} [dateStr] - Data atual no formato YYYY-MM-DD (default: hoje)
 * @returns {boolean} True se o protocolo está ativo neste dia
 */
export function isProtocolActiveOnWeekday(protocol, weekdayIndex, dateStr = getTodayLocal()) {
  if (!protocol || protocol.active === false) return false;

  const frequency = (protocol.frequency || 'diário').toLowerCase();

  // 1. Diário / Diariamente
  if (['diário', 'diariamente', 'daily'].includes(frequency)) {
    return true;
  }

  // 2. Semanal
  if (['semanal', 'semanalmente', 'weekly'].includes(frequency)) {
    const daysArray = getProtocolDays(protocol);
    if (!daysArray || !Array.isArray(daysArray)) return false;
    return daysArray.some(day => WEEKDAY_INDEX_MAP[day.toLowerCase()] === weekdayIndex);
  }

  // 3. Dias alternados / Dia sim, dia não
  if (['dias_alternados', 'dia_sim_dia_nao', 'every_other_day', 'alternating'].includes(frequency)) {
    if (!protocol.start_date) return true; // Sem data, assume ativo
    try {
      const start = parseLocalDate(protocol.start_date);
      const target = parseLocalDate(dateStr);
      const diffTime = target.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % 2 === 0;
    } catch {
      return true;
    }
  }

  // Personalizado, quando necessário, etc. não geram tomadas automáticas agendadas
  return false;
}
