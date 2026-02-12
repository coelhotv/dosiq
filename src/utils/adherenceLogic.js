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
 * Inclui janela de tolerância de 2 horas após o horário agendado.
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

  // Janela de tolerância: 2 horas (120 minutos)
  const toleranceWindowMinutes = 2 * 60;

  // Encontra o próximo horário hoje (incluindo janela de 2h de tolerância)
  // Uma dose é considerada "ativa" até 2 horas após o horário agendado
  const nextToday = scheduleMinutes.find(m => m + toleranceWindowMinutes > currentMinutes);

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
 * Calcula o horário final da janela de tolerância (2h após a próxima dose).
 * Retorna null se não houver próxima dose ou se a dose é do dia seguinte.
 * @param {string} nextDoseTime - Horário da próxima dose no formato HH:mm
 * @returns {string|null} Horário final da janela (HH:mm) ou null
 */
export function getNextDoseWindowEnd(nextDoseTime) {
  if (!nextDoseTime || nextDoseTime === '--:--') {
    return null;
  }

  const [hours, minutes] = nextDoseTime.split(':').map(Number);
  const windowEndMinutes = (hours * 60 + minutes) + (2 * 60); // +2 horas

  const endHours = String(Math.floor(windowEndMinutes / 60) % 24).padStart(2, '0');
  const endMinutes = String(windowEndMinutes % 60).padStart(2, '0');

  return `${endHours}:${endMinutes}`;
}

/**
 * Verifica se a próxima dose está dentro da janela de tolerância (dentro das 2h).
 * @param {string} nextDoseTime - Horário da próxima dose no formato HH:mm
 * @returns {boolean} true se estiver dentro da janela de tolerância
 */
export function isInToleranceWindow(nextDoseTime) {
  if (!nextDoseTime || nextDoseTime === '--:--') {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [hours, minutes] = nextDoseTime.split(':').map(Number);
  const doseMinutes = hours * 60 + minutes;
  const toleranceWindowMinutes = 2 * 60;

  // Está dentro da janela se o horário atual for maior que o agendado
  // mas menor que o agendado + 2 horas
  return currentMinutes > doseMinutes && currentMinutes <= doseMinutes + toleranceWindowMinutes;
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

/**
 * Calcula doses para uma data específica, classificando em tomadas, perdidas e agendadas
 *
 * @param {string} date - Data em formato YYYY-MM-DD (horário local Brasil)
 * @param {Array} logs - Logs de medicamentos do dia
 * @param {Array} protocols - Protocolos ativos
 * @returns {Object} { takenDoses: [], missedDoses: [], scheduledDoses: [] }
 */
export function calculateDosesByDate(date, logs, protocols) {
  if (!date || !protocols || protocols.length === 0) {
    return { takenDoses: [], missedDoses: [], scheduledDoses: [] };
  }

  const takenDoses = [];
  const missedDoses = [];
  const scheduledDoses = [];

  // Converter data string para objeto Date (meia-noite local)
  const targetDate = new Date(date + 'T00:00:00');
  const dayOfWeek = targetDate.getDay(); // 0=Domingo, 1=Segunda, etc.

  // Filtrar protocolos aplicáveis para esta data
  const applicableProtocols = protocols.filter(protocol => {
    // Protocolo deve estar ativo
    if (!protocol.active) return false;

    // Verificar se o protocolo já começou
    if (protocol.start_date) {
      const startDate = new Date(protocol.start_date);
      if (targetDate < startDate) return false;
    }

    // Verificar se o protocolo já terminou
    if (protocol.end_date) {
      const endDate = new Date(protocol.end_date);
      if (targetDate > endDate) return false;
    }

    // Verificar frequência
    const frequency = (protocol.frequency || 'diário').toLowerCase();

    switch (frequency) {
      case 'diário':
      case 'diariamente':
      case 'daily':
        return true;

      case 'semanal':
      case 'semanalmente':
      case 'weekly':
        // Verificar se o dia da semana está nos dias configurados
        if (protocol.days && Array.isArray(protocol.days)) {
          // Mapear nomes de dias para números (0-6)
          const dayMap = {
            'domingo': 0, 'sunday': 0,
            'segunda': 1, 'segunda-feira': 1, 'monday': 1,
            'terça': 2, 'terça-feira': 2, 'tuesday': 2,
            'quarta': 3, 'quarta-feira': 3, 'wednesday': 3,
            'quinta': 4, 'quinta-feira': 4, 'thursday': 4,
            'sexta': 5, 'sexta-feira': 5, 'friday': 5,
            'sábado': 6, 'sabado': 6, 'saturday': 6
          };
          return protocol.days.some(day => dayMap[day.toLowerCase()] === dayOfWeek);
        }
        return false;

      case 'dia_sim_dia_nao':
      case 'dia sim, dia não':
      case 'every_other_day':
      case 'alternating':
        // Calcular dias desde a data de início
        if (protocol.start_date) {
          const startDate = new Date(protocol.start_date);
          const diffTime = targetDate.getTime() - startDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          // Dia sim, dia não: dias pares = dose, ímpares = sem dose
          return diffDays % 2 === 0;
        }
        // Se não tiver data de início, assumir que começa hoje (dia 0 = dose)
        return true;

      case 'personalizado':
      case 'custom':
        // Para frequência personalizada, verificar se há lógica específica
        // Por padrão, assume-se que não há dose
        return false;

      case 'quando_necessário':
      case 'when_needed':
      case 'prn':
        // Doses "quando necessário" não são esperadas
        return false;

      default:
        return true;
    }
  });

  // Gerar slots de doses esperados para cada protocolo aplicável
  const expectedDoses = [];
  applicableProtocols.forEach(protocol => {
    const schedule = protocol.time_schedule || [];
    schedule.forEach(time => {
      expectedDoses.push({
        protocolId: protocol.id,
        medicineId: protocol.medicine_id,
        scheduledTime: time,
        expectedQuantity: protocol.dosage_per_intake || 1,
        protocol: protocol,
        medicine: protocol.medicine || null
      });
    });
  });

  // Criar cópia dos logs para rastrear quais já foram associados
  const unmatchedLogs = [...(logs || [])];

  // Para cada dose esperada, tentar encontrar um log correspondente
  expectedDoses.forEach(expectedDose => {
    let matchedLogIndex = -1;

    // Procurar log que corresponda a este horário esperado
    for (let i = 0; i < unmatchedLogs.length; i++) {
      const log = unmatchedLogs[i];
      
      // Verificar se o log é do mesmo protocolo
      if (log.protocol_id !== expectedDose.protocolId) continue;

      // Verificar se está na janela de tolerância (+/- 2h)
      if (isDoseInToleranceWindow(expectedDose.scheduledTime, log.taken_at)) {
        matchedLogIndex = i;
        break;
      }
    }

    if (matchedLogIndex >= 0) {
      // Dose tomada - mover log para takenDoses
      const matchedLog = unmatchedLogs.splice(matchedLogIndex, 1)[0];
      takenDoses.push({
        ...matchedLog,
        scheduledTime: expectedDose.scheduledTime,
        expectedQuantity: expectedDose.expectedQuantity
      });
    } else {
      // Dose não tomada - verificar se é perdida (passado) ou agendada (futuro)
      const [scheduledHour, scheduledMinute] = expectedDose.scheduledTime.split(':').map(Number);
      
      // Obter data/hora atual em Brazil (UTC-3)
      const now = new Date();
      const brazilTimeString = now.toLocaleString('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      // Parse Brazil time string (format: MM/DD/YYYY, HH:mm)
      const [datePart, timePart] = brazilTimeString.split(', ');
      const [month, day, year] = datePart.split('/');
      const [currentHour, currentMinute] = timePart.split(':').map(Number);
      
      // Comparar datas primeiro (YYYY-MM-DD format)
      const currentDateStr = `${year}-${month}-${day}`;
      let isPast;
      
      if (date < currentDateStr) {
        // Data da dose é anterior ao dia atual no Brazil = perdida
        isPast = true;
      } else if (date > currentDateStr) {
        // Data da dose é futura no Brazil = agendada
        isPast = false;
      } else {
        // Mesma data no Brazil - comparar horários
        const scheduledTimeMinutes = scheduledHour * 60 + scheduledMinute;
        const currentTimeMinutes = currentHour * 60 + currentMinute;
        isPast = scheduledTimeMinutes < currentTimeMinutes;
      }
      
      const baseDose = {
        id: `${isPast ? 'missed' : 'scheduled'}-${expectedDose.protocolId}-${expectedDose.scheduledTime}`,
        protocol_id: expectedDose.protocolId,
        medicine_id: expectedDose.medicineId,
        scheduledTime: expectedDose.scheduledTime,
        expectedQuantity: expectedDose.expectedQuantity,
        quantity_taken: 0,
        protocol: expectedDose.protocol,
        medicine: expectedDose.medicine,
        isSynthetic: true
      };
      
      if (isPast) {
        // Dose perdida - horário já passou
        missedDoses.push({
          ...baseDose,
          status: 'missed'
        });
      } else {
        // Dose agendada - horário ainda não chegou
        scheduledDoses.push({
          ...baseDose,
          status: 'scheduled'
        });
      }
    }
  });

  // Logs restantes que não correspondem a nenhuma dose esperada
  // (doses extras, fora do horário, etc.) - adicionar como takenDoses
  unmatchedLogs.forEach(log => {
    takenDoses.push({
      ...log,
      scheduledTime: null,
      expectedQuantity: log.quantity_taken || 1,
      isExtra: true
    });
  });

  return { takenDoses, missedDoses, scheduledDoses };
}
