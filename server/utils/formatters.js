import {
  getCurrentTime as getLocalTime
} from './dateUtils';

/**
 * Format time in HH:MM format for Brazil timezone (legacy)
 * @deprecated Use getCurrentTime from dateUtils.js instead
 */
export function getCurrentTime() {
  return getLocalTime();
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
// Auxiliar para formatar status de estoque não-diário.
function _formatNonDailyStockStatus(daysRemaining, doseMetrics, status) {
  const d = doseMetrics.dosesRemaining;
  let result = status + `💉 Restam ${d} ${d === 1 ? 'dose' : 'doses'}\n`;
  if (daysRemaining !== null) {
    // `~` é reservado em MarkdownV2 → escapar `\~` senão o Telegram falha o parse.
    result += daysRemaining <= 0
      ? `⚠️ *SEM ESTOQUE*\n`
      : `${daysRemaining <= 7 ? '⚠️' : '✅'} Acaba em \\~${daysRemaining} dias\n`;
  }
  return result;
}

// Auxiliar para formatar status de estoque diário.
function _formatDailyStockStatus(daysRemaining, status) {
  let result = status;
  if (daysRemaining !== null) {
    if (daysRemaining <= 0) {
      result += `⚠️ *SEM ESTOQUE*\n`;
    } else if (daysRemaining <= 7) {
      result += `⚠️ Acaba em ${daysRemaining} dias\n`;
    } else {
      result += `✅ Acaba em ${daysRemaining} dias\n`;
    }
  }
  return result;
}

export function formatStockStatus(medicine, totalQuantity, daysRemaining, doseMetrics = null) {
  // Líquidos (022): saldo é em ml, não na unidade de concentração (mg/ml).
  const isLiquid = Boolean(medicine.dosage_unit?.endsWith('/ml'));
  const unit = escapeMarkdownV2(isLiquid ? 'ml' : (medicine.dosage_unit || 'unidades'));
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  let status = `💊 *${name}*\n`;
  status += `📦 Estoque: ${totalQuantity} ${unit}\n`;

  // 012 B4 / ADR-067: freq ≠ diário → doses como número-base, runway como contexto.
  if (doseMetrics && !doseMetrics.isDaily && Number.isFinite(doseMetrics.dosesRemaining)) {
    return _formatNonDailyStockStatus(daysRemaining, doseMetrics, status);
  }

  return _formatDailyStockStatus(daysRemaining, status);
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
  // Líquidos (022): mostra a unidade de tomada (gotas/ml/UI) em vez de "Nx".
  const intakeLabel = protocol.intake_unit
    ? ` ${escapeMarkdownV2(protocol.intake_unit)}`
    : 'x';

  let msg = `💊 *${name}*\n`;
  msg += `⏰ Horários: ${times}\n`;
  msg += `📏 Dose: ${dosage}${intakeLabel}\n`;
  
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
