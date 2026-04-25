/**
 * Formatters MarkdownV2 para notificações de doses agrupadas (Wave N1).
 * Usados pelo checkRemindersViaDispatcher em tasks.js.
 */

import { escapeMarkdownV2 } from '../../utils/formatters.js';

const MAX_DOSES_SHOWN = 10;

/**
 * Emoji de saudação por horário do dia.
 * @param {number} hour - Hora local (0–23)
 * @returns {string}
 */
export function getTimeOfDayEmoji(hour) {
  if (hour >= 5 && hour < 11) return '🌅';
  if (hour >= 11 && hour < 14) return '🍽️';
  if (hour >= 14 && hour < 18) return '☕';
  if (hour >= 18 && hour < 23) return '🌆';
  return '🌙';
}

/**
 * Formata mensagem MarkdownV2 para bloco by_plan (Telegram).
 *
 * Exemplo de saída:
 *   🌅 *Quarteto Fantástico — ICFEr*
 *
 *   4 medicamentos agora — 08:00
 *
 *     💊 Atorvastatina — 1 cp
 *     💊 SeloZok — 1 cp
 *   … e mais 2
 *
 *   [ ✅ Registrar este plano ]  [ 📋 Ver detalhes ]
 *
 * @param {string} planName - Nome do plano de tratamento
 * @param {import('./partitionDoses.js').DoseEntry[]} doses - Doses do bloco
 * @param {string} scheduledTime - HHMM ex: "08:00"
 * @param {number} hour - Hora para emoji
 * @returns {string} Mensagem MarkdownV2
 */
export function formatDoseGroupedByPlanMessage(planName, doses, scheduledTime, hour = new Date().getHours()) {
  const emoji = getTimeOfDayEmoji(hour);
  const safePlanName = escapeMarkdownV2(planName || 'Plano de tratamento');
  const safeTime = escapeMarkdownV2(scheduledTime);
  const count = doses.length;
  const shown = doses.slice(0, MAX_DOSES_SHOWN);
  const extra = count - shown.length;

  const doseLines = shown.map(d => {
    const name = escapeMarkdownV2(d.medicineName || 'Medicamento');
    // AP-W12: usar ?? para não converter 0 em 1
    const qty = escapeMarkdownV2(String(d.dosagePerIntake ?? 1));
    return `  💊 ${name} — ${qty} cp`;
  }).join('\n');

  let body = `${emoji} *${safePlanName}*\n\n${escapeMarkdownV2(String(count))} medicamentos agora — ${safeTime}\n\n${doseLines}`;

  if (extra > 0) {
    body += `\n  _… e mais ${escapeMarkdownV2(String(extra))}_`;
  }

  return body;
}

/**
 * Formata mensagem MarkdownV2 para bloco misc / sobra consolidada (Telegram).
 *
 * Exemplo de saída:
 *   ☀️ *Suas doses agora* — 08:00
 *
 *   2 medicamentos pendentes:
 *
 *     • Ômega 3 — 1 cp
 *     • Trimebutina — 1 cp
 *
 * @param {import('./partitionDoses.js').DoseEntry[]} doses - Doses do bloco misc
 * @param {string} scheduledTime - HHMM ex: "08:00"
 * @param {number} hour - Hora para emoji
 * @returns {string} Mensagem MarkdownV2
 */
export function formatDoseGroupedMiscMessage(doses, scheduledTime, hour = new Date().getHours()) {
  const emoji = getTimeOfDayEmoji(hour);
  const safeTime = escapeMarkdownV2(scheduledTime);
  const count = doses.length;
  const shown = doses.slice(0, MAX_DOSES_SHOWN);
  const extra = count - shown.length;

  const doseLines = shown.map(d => {
    const name = escapeMarkdownV2(d.medicineName || 'Medicamento');
    const qty = escapeMarkdownV2(String(d.dosagePerIntake ?? 1));
    return `  • ${name} — ${qty} cp`;
  }).join('\n');

  let body = `${emoji} *Suas doses agora* — ${safeTime}\n\n${escapeMarkdownV2(String(count))} medicamento${count !== 1 ? 's' : ''} pendente${count !== 1 ? 's' : ''}:\n\n${doseLines}`;

  if (extra > 0) {
    body += `\n  _… e mais ${escapeMarkdownV2(String(extra))}_`;
  }

  return body;
}
