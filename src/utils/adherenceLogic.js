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
  const toLocalDateString = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const logsByDay = new Map();
  logs.forEach(log => {
    const dayKey = toLocalDateString(log.taken_at);
    if (!logsByDay.has(dayKey)) logsByDay.set(dayKey, []);
    logsByDay.get(dayKey).push(log);
  });

  let totalExpected = 0;
  let totalFollowed = 0;
  let totalTakenAnytime = 0;
  let currentStreak = 0;
  const todayStr = toLocalDateString(new Date());

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = toLocalDateString(date);
    const dayLogs = logsByDay.get(dateStr) || [];
    
    let dayExpected = 0;
    let dayFollowed = 0;
    let dayTakenAnytime = 0;

    protocols.forEach(protocol => {
      // Simplificação: Assume que todos os protocolos ativos devem ser seguidos todos os dias
      // Em uma versão futura, considerar a frequência (daily, weekly, etc) aqui também
      const schedule = protocol.time_schedule || [];
      dayExpected += schedule.length;
      
      schedule.forEach(time => {
        if (isProtocolFollowed(time, dayLogs, dateStr)) {
          dayFollowed++;
        }
        
        // Verifica se tomou em qualquer horário do dia
        if (dayLogs.some(l => l.protocol_id === protocol.id)) {
          dayTakenAnytime++;
        }
      });
    });

    totalExpected += dayExpected;
    totalFollowed += dayFollowed;
    totalTakenAnytime += dayTakenAnytime;

    // Lógica de Streak
    const minAdherence = 0.8;
    const isDaySuccessful = dayExpected > 0 && (dayFollowed / dayExpected >= minAdherence);
    
    if (isDaySuccessful) {
      currentStreak++;
    } else if (dateStr === todayStr) {
      // Se hoje ainda não terminou, não quebra o streak
      continue;
    } else if (i > 0 || (i === 0 && dayExpected > 0)) {
      // Se não for hoje e falhou, ou se for hoje e já temos falha clara, interrompe
      // Mas só se houver doses esperadas
      if (dayExpected > 0) break;
    }
  }

  const score = totalExpected > 0 ? Math.min(Math.round((totalFollowed / totalExpected) * 100), 100) : 0;

  return {
    score,
    taken: totalFollowed, // Representa doses seguidas corretamente na janela
    takenAnytime: totalTakenAnytime,
    expected: totalExpected,
    currentStreak
  };
}

/**
 * Verifica se um protocolo foi seguido para um determinado horário,
 * implementando a janela de +/- 2h de tolerância.
 *
 * @param {string} scheduledTime - Horário previsto "HH:mm" (local)
 * @param {Array} logs - Lista de logs (em UTC)
 * @param {string} dateStr - Data local de referência "YYYY-MM-DD"
 * @returns {boolean}
 */
export function isProtocolFollowed(scheduledTime, logs, dateStr) {
  if (!scheduledTime || !logs || logs.length === 0) return false;

  return logs.some(log => {
    // 1. Verificar se o log é do mesmo dia local
    const logDate = new Date(log.taken_at);
    const lYear = logDate.getFullYear();
    const lMonth = String(logDate.getMonth() + 1).padStart(2, '0');
    const lDay = String(logDate.getDate()).padStart(2, '0');
    const logDateStr = `${lYear}-${lMonth}-${lDay}`;

    if (logDateStr !== dateStr) return false;

    // 2. Verificar janela de 2h
    return isDoseInToleranceWindow(scheduledTime, log.taken_at);
  });
}

/**
 * Verifica se uma dose foi tomada dentro da janela de tolerância de +/- 2 horas.
 *
 * @param {string} scheduledTime - Horário previsto "HH:mm" (local)
 * @param {string} logTakenAt - ISO timestamp do log (UTC)
 * @returns {boolean}
 */
export function isDoseInToleranceWindow(scheduledTime, logTakenAt) {
  if (!scheduledTime || !logTakenAt) return false;

  const [sH, sM] = scheduledTime.split(':').map(Number);
  const takenDate = new Date(logTakenAt);
  
  // Criamos um objeto Date para o horário previsto no MESMO DIA da dose tomada,
  // usando o fuso horário local do dispositivo do usuário.
  const scheduledDate = new Date(takenDate);
  scheduledDate.setHours(sH, sM, 0, 0);

  const diffMs = Math.abs(takenDate.getTime() - scheduledDate.getTime());
  const twoHoursInMs = 2 * 60 * 60 * 1000;

  return diffMs <= twoHoursInMs;
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

/**
 * Calcula a ingestão diária total de um medicamento baseado em seus protocolos ativos
 * @param {string} medicineId
 * @param {Array} protocols
 * @returns {number}
 */
export function calculateDailyIntake(medicineId, protocols) {
  if (!protocols) return 0;
  
  return protocols
    .filter(p => p.medicine_id === medicineId && p.active)
    .reduce((total, p) => {
      const dosesPerDay = p.time_schedule?.length || 1;
      const dosage = p.dosage_per_intake || 1;
      return total + (dosesPerDay * dosage);
    }, 0);
}

/**
 * Calcula dias restantes de estoque
 * @param {number} totalQuantity
 * @param {number} dailyIntake
 * @returns {number}
 */
export function calculateDaysRemaining(totalQuantity, dailyIntake) {
  if (dailyIntake <= 0) return Infinity;
  return Math.floor(totalQuantity / dailyIntake);
}
