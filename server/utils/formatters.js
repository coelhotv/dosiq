import { getCurrentTimeInTimezone } from './timezone.js';

/**
 * Format time in HH:MM format for Brazil timezone (legacy)
 * @deprecated Use getCurrentTimeInTimezone from timezone.js instead
 */
export function getCurrentTime() {
  return getCurrentTimeInTimezone('America/Sao_Paulo');
}

/**
 * Calculate days remaining based on stock and daily usage
 */
export function calculateDaysRemaining(totalQuantity, dailyUsage) {
  if (!dailyUsage || dailyUsage <= 0) return null;
  return Math.floor(totalQuantity / dailyUsage);
}

/**
 * Formata mensagem de status do estoque.
 * @param {object} medicine - Objeto do medicamento com name e dosage_unit
 * @param {number} totalQuantity - Quantidade total em estoque
 * @param {number|null} daysRemaining - Dias restantes de estoque
 * @returns {string} Mensagem formatada com escape MarkdownV2
 */
export function formatStockStatus(medicine, totalQuantity, daysRemaining) {
  const unit = escapeMarkdownV2(medicine.dosage_unit || 'unidades');
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  let status = `💊 *${name}*\n`;
  status += `📦 Estoque: ${totalQuantity} ${unit}\n`;
  
  if (daysRemaining !== null) {
    if (daysRemaining <= 0) {
      status += `⚠️ *SEM ESTOQUE*\n`;
    } else if (daysRemaining <= 7) {
      status += `⚠️ Acaba em ~${daysRemaining} dias\n`;
    } else {
      status += `✅ Acaba em ~${daysRemaining} dias\n`;
    }
  }
  
  return status;
}

/**
 * Formata informações do protocolo.
 * @param {object} protocol - Objeto do protocolo com medicine, time_schedule, etc.
 * @returns {string} Mensagem formatada com escape MarkdownV2
 */
export function formatProtocol(protocol) {
  const name = escapeMarkdownV2(protocol.medicine?.name || 'Medicamento');
  const times = escapeMarkdownV2(protocol.time_schedule?.join(', ') || '');
  const dosage = escapeMarkdownV2(String(protocol.dosage_per_intake ?? 1));
  
  let msg = `💊 *${name}*\n`;
  msg += `⏰ Horários: ${times}\n`;
  msg += `📏 Dose: ${dosage}x\n`;
  
  if (protocol.titration_schedule && protocol.titration_schedule.length > 0) {
    const currentStage = protocol.current_stage_index || 0;
    msg += `🎯 Titulação: Etapa ${currentStage + 1}/${protocol.titration_schedule.length}\n`;
  }
  
  if (protocol.notes) {
    const notes = escapeMarkdownV2(protocol.notes);
    msg += `📝 _${notes}_\n`;
  }
  
  return msg;
}

/**
 * Calculate adherence streak (days in a row with at least one dose) 
 * in a specific timezone.
 */
export function calculateStreak(logs, timezone = 'America/Sao_Paulo') {
  if (!logs || logs.length === 0) return 0;
  
  // Get unique local dates (YYYY-MM-DD) in the target timezone
  const localDates = logs
    .map(l => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(l.taken_at)))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => b.localeCompare(a)); // Descending "2026-01-21", "2026-01-20"...

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

  // If no logs at all for today OR yesterday, streak is broken
  // (We allow today to be empty if it's still early, as long as yesterday has a log)
  const firstLogDate = localDates[0];
  const d1 = new Date(today);
  const d2 = new Date(firstLogDate);
  const diffDays = Math.round(Math.abs((d1 - d2) / (1000 * 60 * 60 * 24)));

  if (diffDays > 1) return 0;

  let streak = 0;
  let currentRef = new Date(firstLogDate);
  
  for (let i = 0; i < localDates.length; i++) {
    const dateStr = localDates[i];
    const dateObj = new Date(dateStr);
    
    // Check if this date is 'currentRef'
    const diff = Math.round((currentRef - dateObj) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) {
      streak++;
      // Move reference to yesterday
      currentRef.setDate(currentRef.getDate() - 1);
    } else {
      // Gap found
      break;
    }
  }
  
  return streak;
}

/**
 * Escapa caracteres especiais para o formato Telegram MarkdownV2.
 * Conforme: https://core.telegram.org/bots/api#markdownv2-style
 * 
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto seguro para MarkdownV2
 * 
 * @example
 * escapeMarkdownV2("Omega 3!") // Retorna "Omega 3\!"
 * escapeMarkdownV2("Vitamina D (1000UI)") // Retorna "Vitamina D \(1000UI\)"
 */
export function escapeMarkdownV2(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Uma única regex com callback para melhor performance
  // Ordem importa: primeiro escaping de backslash para evitar double-escaping
  // Nota: dentro de [], apenas ] e \ precisam de escape, não _ ou [

  return text.replace(/([\\*()`>#+\-=|{}.!_[\]~])/g, (match) => {
    const escapeMap = {
      '\\': '\\\\',
      '_': '\\_',
      '*': '\\*',
      '[': '\\[',
      ']': '\\]',
      '(': '\\(',
      ')': '\\)',
      '~': '\\~',
      '`': '\\`',
      '>': '\\>',
      '#': '\\#',
      '+': '\\+',
      '-': '\\-',
      '=': '\\=',
      '|': '\\|',
      '{': '\\{',
      '}': '\\}',
      '.': '\\.',
      '!': '\\!'
    };
    return escapeMap[match] || match;
  });
}
