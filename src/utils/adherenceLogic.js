/**
 * Adherence Logic - Funções puras para cálculo de adesão client-side
 * 
 * Migrado de adherenceService para suportar "Custo Zero" de queries.
 * @module adherenceLogic
 */

/**
 * Calcula doses esperadas para um conjunto de protocolos em um período
 * @param {Array} protocols 
 * @param {number} days 
 * @returns {number}
 */
export function calculateExpectedDoses(protocols, days) {
  if (!protocols || protocols.length === 0) return 0;

  return protocols.reduce((total, protocol) => {
    const timesPerDay = protocol.time_schedule?.length || 1;
    const frequency = protocol.frequency || 'daily';

    let dailyDoses = timesPerDay;

    switch (frequency.toLowerCase()) {
      case 'daily':
      case 'diariamente':
      case 'diário':
        dailyDoses = timesPerDay;
        break;
      case 'weekly':
      case 'semanal':
      case 'semanalmente':
        dailyDoses = timesPerDay / 7;
        break;
      case 'every_other_day':
      case 'dia_sim_dia_nao':
      case 'dia sim, dia não':
        dailyDoses = timesPerDay / 2;
        break;
      default:
        dailyDoses = timesPerDay;
    }

    return total + (dailyDoses * days);
  }, 0);
}

/**
 * Calcula o streak e score baseado em logs e protocolos em memória
 * @param {Array} logs 
 * @param {Array} protocols 
 * @param {number} days 
 * @returns {Object}
 */
export function calculateAdherenceStats(logs, protocols, days = 30) {
  const expected = calculateExpectedDoses(protocols, days);
  const taken = logs.length;
  const score = expected > 0 ? Math.min(Math.round((taken / expected) * 100), 100) : 0;

  // Cálculo de Streak (simplificado para in-memory com suporte a fuso horário local)
  const dailyExpected = protocols.reduce((acc, p) => acc + (p.time_schedule?.length || 1), 0);
  const logsByDay = new Map();
  
  const toLocalDateString = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  logs.forEach(log => {
    const dayKey = toLocalDateString(log.taken_at);
    logsByDay.set(dayKey, (logsByDay.get(dayKey) || 0) + 1);
  });

  let currentStreak = 0;
  const today = toLocalDateString(new Date());
  const minAdherence = 0.8;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = toLocalDateString(date);
    const dayTaken = logsByDay.get(key) || 0;
    
    if (dailyExpected > 0 && dayTaken / dailyExpected >= minAdherence) {
      currentStreak++;
    } else if (key === today) {
      // Se for hoje e ainda não bateu a meta, não quebra o streak
      continue;
    } else {
      break;
    }
  }

  return {
    score,
    taken,
    expected,
    currentStreak
  };
}

/**
 * Calcula o horário da próxima dose baseado no cronograma do protocolo
 * @param {Object} protocol
 * @returns {string} HH:mm ou '--:--'
 */
export function getNextDoseTime(protocol) {
  if (!protocol || !protocol.time_schedule || protocol.time_schedule.length === 0) {
    return '--:--';
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Converte horários do cronograma para minutos e ordena
  const scheduleMinutes = protocol.time_schedule
    .map(time => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    })
    .sort((a, b) => a - b);

  // Encontra o próximo horário hoje
  const nextToday = scheduleMinutes.find(m => m > currentMinutes);

  if (nextToday !== undefined) {
    const h = String(Math.floor(nextToday / 60)).padStart(2, '0');
    const m = String(nextToday % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  // Se não houver mais doses hoje, retorna a primeira dose de amanhã
  const firstTomorrow = scheduleMinutes[0];
  const h = String(Math.floor(firstTomorrow / 60)).padStart(2, '0');
  const m = String(firstTomorrow % 60).padStart(2, '0');
  return `${h}:${m}`;
}
