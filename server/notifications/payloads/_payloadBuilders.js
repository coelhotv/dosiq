import {
  dailyDigestDataSchema,
  adherenceReportDataSchema,
  weeklyAdherenceDataSchema,
  stockAlertDataSchema,
  stockExpiryAlertDataSchema,
  titrationAlertDataSchema,
  prescriptionAlertDataSchema,
  dlqDigestDataSchema
} from './_payloadSchemas.js';
import { escapeMarkdownV2 } from '../../utils/formatters.js';
import { getGreeting, getMotivationalNudge, getTimeOfDayGreeting } from '../../bot/utils/notificationHelpers.js';
import { getSaoPauloTime } from '../../utils/dateUtils';
import { formatDoseItem } from '@dosiq/core';

// 012 Fase D (FR-015b): frase de dose via formatters core (R-272). Líquido →
// unidade de tomada real (gotas/ml/UI + ≈ml), case canônico (UI upper). Sólido →
// hint de princípio ativo. Substitui o antigo formatDose local lossy ("1 un." p/
// mg/ml; lowercase). Sem dose válida → undefined (mantém guarda do call site).
const formatDigestDose = (m) => {
  if (m.dosagePerIntake === undefined || m.dosagePerIntake === null) return undefined;
  return formatDoseItem({
    dosagePerIntake: m.dosagePerIntake,
    intakeUnit: m.intakeUnit,
    dosageUnit: m.dosageUnit,
    dosagePerPill: m.dosagePerPill,
    unitsPerMl: m.unitsPerMl
  });
};

export function buildDailyDigestPayload(data) {
  const { firstName, hour, pendingCount, medicines } = dailyDigestDataSchema.parse(data);
  const greeting = getGreeting(hour);
  const title = '📅 Resumo do Dia';
  const safeName = escapeMarkdownV2(firstName);
  
  let richMsg = `${greeting}, *${safeName}*\\!\n\n`;
  let plainMsg = `${greeting}, ${firstName}! `;
  
  if (pendingCount > 0) {
    const text = pendingCount === 1 ? 'dose pendente' : 'doses pendentes';
    richMsg += `Você tem *${pendingCount}* ${text} para hoje:\n\n`;
    plainMsg += `Você tem ${pendingCount} ${text} para hoje:\n`;
    
    medicines.forEach(m => {
      const displayDosage = formatDigestDose(m);
      richMsg += `💊 *${escapeMarkdownV2(m.name)}*\n`;
      richMsg += `⏰ ${escapeMarkdownV2(m.time)}${displayDosage ? ` \\(${escapeMarkdownV2(displayDosage)}\\)` : ''}\n\n`;
      plainMsg += `⏰ ${m.name} — ${m.time}${displayDosage ? ` (${displayDosage})` : ''}\n`;
    });
    richMsg += `Não se esqueça de registrar no app\\!`;
    plainMsg += `Não se esqueça de registrar no app!`;
  } else {
    const success = `Você está em dia com todos os seus medicamentos de hoje\\! 🎉`;
    const plainSuccess = `Você está em dia com todos os seus medicamentos de hoje! 🎉`;
    richMsg += success;
    plainMsg += plainSuccess;
  }
  
  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildAdherenceReportPayload(data) {
  const { firstName, period, percentage, taken, total, comparison } = adherenceReportDataSchema.parse(data);
  const nudge = getMotivationalNudge(percentage);
  const title = '📈 Relatório diário';
  
  const safeName = escapeMarkdownV2(firstName);
  const safePeriod = escapeMarkdownV2(period);
  
  let richMsg = `Olá, *${safeName}*\\!\n\n`;
  richMsg += `Sua adesão ${safePeriod} foi de *${percentage}%*\n`;
  richMsg += `✅ *${taken}* de *${total}* doses registradas\\.\n\n`;
  
  let plainMsg = `Olá, ${firstName}! \n`;
  plainMsg += `Sua adesão ${period} foi de ${percentage}% `;
  plainMsg += `✅ ${taken} de ${total} doses registradas.\n`;
  
  if (comparison) {
    const { deltaPercent, trend } = comparison;
    const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
    // Relatório matinal: os dados são de ONTEM → a comparação é com ANTEONTEM
    // (não "vs ontem"). O builder já usa beforeYesterdayCounts como base.
    const trendText = trend === 'up'
      ? `Melhora de ${deltaPercent}% vs anteontem`
      : trend === 'down'
      ? `Queda de ${deltaPercent}% vs anteontem`
      : `Estável vs anteontem`;

    richMsg += `*Comparação:* ${trendEmoji} ${escapeMarkdownV2(trendText)}\n\n`;
    plainMsg += `Comparação: ${trendEmoji} ${trendText}\n`;
  }
  
  richMsg += `_${escapeMarkdownV2(nudge)}_`;
  plainMsg += nudge;
  
  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildWeeklyAdherencePayload(data) {
  const { firstName, percentage, taken, total } = weeklyAdherenceDataSchema.parse(data);
  const nudge = getMotivationalNudge(percentage);
  const title = '📊 Relatório Semanal';

  const safeName = escapeMarkdownV2(firstName);

  let richMsg = `Olá, *${safeName}*\\!\n\n`;
  richMsg += `Sua adesão na última semana foi de *${percentage}%*\n`;
  richMsg += `✅ *${taken}* de *${total}* doses registradas\\.\n\n`;
  richMsg += `_${escapeMarkdownV2(nudge)}_`;

  let plainMsg = `Olá, ${firstName}!\n`;
  plainMsg += `Sua adesão na última semana foi de ${percentage}% `;
  plainMsg += `✅ ${taken} de ${total} doses registradas.\n`;
  plainMsg += nudge;

  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildDoseReminderByPlanPayload(data) {
  const n = data.doses?.length ?? 0;
  const planName = data.planName ?? 'Plano de tratamento';
  const scheduledTime = data.scheduledTime ?? 'agora';
  const hour = data.hour ?? getSaoPauloTime().getHours();
  
  const greeting = getTimeOfDayGreeting(hour);
  const title = `${greeting} — ${planName}`;
  
  const body = `Está na hora de tomar ${n} medicamento${n !== 1 ? 's' : ''} do seu plano \\(${escapeMarkdownV2(scheduledTime)}\\)\\.`;
  const pushBody = `Está na hora de tomar ${n} medicamento${n !== 1 ? 's' : ''} do seu plano (${scheduledTime}).`;
  return { title, body, pushBody };
}

export function buildDoseReminderMiscPayload(data) {
  const n = data.doses?.length ?? 0;
  const scheduledTime = data.scheduledTime ?? 'agora';
  const hour = data.hour ?? getSaoPauloTime().getHours();
  
  const title = getTimeOfDayGreeting(hour);
  const body = `Você tem ${n} medicamento${n !== 1 ? 's' : ''} pendente${n !== 1 ? 's' : ''} para ${escapeMarkdownV2(scheduledTime)}\\. Clique para registrar\\.`;
  const pushBody = `Você tem ${n} medicamento${n !== 1 ? 's' : ''} pendente${n !== 1 ? 's' : ''} para ${scheduledTime}. Clique para registrar.`;
  return { title, body, pushBody };
}

export function buildStockAlertPayload(data) {
  const { medicineName, remaining, daysRemaining } = stockAlertDataSchema.parse(data);
  const title = `📦 Alerta de Estoque: ${medicineName}`;
  
  let richMsg = `📉 **Restam:** ${remaining} doses\\.\n`;
  let plainMsg = `📉 Restam: ${remaining} doses.\n`;
  
  if (daysRemaining !== undefined) {
    richMsg += `⏳ **Previsão:** Acaba em aproximadamente **${daysRemaining} dias**\\.\n\n`;
    plainMsg += `⏳ Previsão: Acaba em aproximadamente ${daysRemaining} dias.\n\n`;
  }
  
  const footer = `Recomendamos a reposição em breve\\.`;
  const plainFooter = `Recomendamos a reposição em breve.`;
  richMsg += footer;
  plainMsg += plainFooter;
  
  return { title, body: richMsg, pushBody: plainMsg };
}

// 012 Fase A (ADR-059): validade biologica (TTL pos-abertura) — eixo distinto do
// alerta de volume (stock_alert). Cadencia D-3 + vencimento e controlada no cron.
export function buildStockExpiryAlertPayload(data) {
  const { medicineName, daysLeft } = stockExpiryAlertDataSchema.parse(data);
  const title = `⏰ Validade após aberto: ${medicineName}`;
  const safeName = escapeMarkdownV2(medicineName);

  let richMsg;
  let plainMsg;
  if (daysLeft <= 0) {
    richMsg = `O frasco/caneta aberto de *${safeName}* atingiu hoje o limite de uso após a abertura\\.\n\nRecomendamos iniciar um novo frasco/refil\\. Confira a bula\\.`;
    plainMsg = `O frasco/caneta aberto de ${medicineName} atingiu hoje o limite de uso após a abertura.\n\nRecomendamos iniciar um novo frasco/refil. Confira a bula.`;
  } else {
    const diaLabel = daysLeft === 1 ? 'dia' : 'dias';
    richMsg = `O frasco/caneta aberto de *${safeName}* vence em *${daysLeft} ${diaLabel}* \\(validade após aberto\\)\\.\n\nPrograme\\-se para abrir um novo\\.`;
    plainMsg = `O frasco/caneta aberto de ${medicineName} vence em ${daysLeft} ${diaLabel} (validade após aberto).\n\nPrograme-se para abrir um novo.`;
  }

  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildTitrationAlertPayload(data) {
  const { medicineName, currentStage, totalStages, status, nextStage, requiresNewMedicine } = titrationAlertDataSchema.parse(data);
  // 012 Fase B2 (FR-021): etapa cross-força → CTA de troca de apresentação.
  const title = requiresNewMedicine ? '🔄 Hora de trocar de apresentação' : '🎯 Atualização de Titulação';

  let richMsg = requiresNewMedicine ? `🔄 *Hora de trocar de apresentação*\n\n` : `🎯 *Atualização de Titulação*\n\n`;
  richMsg += `Medicamento: **${escapeMarkdownV2(medicineName)}**\n`;
  // 012 Fase B (FR-005b): disparado SÓ no evento de avanço — copy informativa,
  // sem CTA de dose (SaMD/ADR-062). B2: etapa cross-força avisa a troca de caneta.
  if (requiresNewMedicine) {
    richMsg += `A etapa ${currentStage}/${totalStages} do cronograma usa uma nova apresentação \\(ex\\.: outra caneta\\)\\. Confira se você tem o medicamento certo em estoque\\.\n\n`;
  } else {
    richMsg += `Etapa ${currentStage}/${totalStages} iniciada conforme o cronograma\\.\n\n`;
  }

  let plainMsg = requiresNewMedicine ? `🔄 Hora de trocar de apresentação\n` : `🎯 Atualização de Titulação\n`;
  plainMsg += `Medicamento: ${medicineName}\n`;
  if (requiresNewMedicine) {
    plainMsg += `A etapa ${currentStage}/${totalStages} do cronograma usa uma nova apresentação (ex.: outra caneta). Confira se você tem o medicamento certo em estoque.\n\n`;
  } else {
    plainMsg += `Etapa ${currentStage}/${totalStages} iniciada conforme o cronograma.\n\n`;
  }

  if (status === 'alvo_atingido') {
    const success = `✅ *Parabéns\\!* Você atingiu a dose alvo\\!\nContinue com o acompanhamento médico\\.`;
    const plainSuccess = `✅ Parabéns! Você atingiu a dose alvo!\nContinue com o acompanhamento médico.`;
    richMsg += success;
    plainMsg += plainSuccess;
  } else if (status === 'titulando' && nextStage) {
    richMsg += `📈 Próxima etapa: ${escapeMarkdownV2(nextStage.dosage)} ${escapeMarkdownV2(nextStage.unit)}\n`;
    richMsg += `⏰ Data prevista: ${escapeMarkdownV2(nextStage.date || 'a definir')}`;
    
    plainMsg += `📈 Próxima etapa: ${nextStage.dosage} ${nextStage.unit}\n`;
    plainMsg += `⏰ Data prevista: ${nextStage.date || 'a definir'}`;
  }

  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildMonthlyReportPayload(data) {
  const { firstName, percentage, taken, total } = adherenceReportDataSchema.parse(data);
  const title = '🗓️ Relatório Mensal';
  
  let richMsg = `📊 *Seu Relatório Mensal*\n\n`;
  richMsg += `Olá ${escapeMarkdownV2(firstName)}, sua taxa de adesão no último mês foi de **${percentage}%**\\.\n`;
  richMsg += `✅ **Doses tomadas:** ${taken}\n`;
  richMsg += `📝 **Doses esperadas:** ${total}\n\n`;
  
  let plainMsg = `📊 Seu Relatório Mensal\n`;
  plainMsg += `Olá ${firstName}, sua taxa de adesão no último mês foi de ${percentage}%.\n`;
  plainMsg += `✅ Doses tomadas: ${taken}\n`;
  plainMsg += `📝 Doses esperadas: ${total}\n\n`;
  
  let nudge = '';
  let plainNudge = '';
  if (percentage >= 90) { nudge = `🚀 *Desempenho excepcional\\!* Continue assim\\.`; plainNudge = `🚀 Desempenho excepcional! Continue assim.`; }
  else if (percentage >= 70) { nudge = `💪 *Bom trabalho\\!* Vamos buscar os 100% no próximo mês?`; plainNudge = `💪 Bom trabalho! Vamos buscar os 100% no próximo mês?`; }
  else { nudge = `💡 *Lembrete:* Manter a constância é fundamental para o sucesso do tratamento\\.`; plainNudge = `💡 Lembrete: Manter a constância é fundamental para o sucesso do tratamento.`; }
  
  richMsg += nudge;
  plainMsg += plainNudge;
  
  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildPrescriptionAlertPayload(data) {
  const { medicineName, endDate, daysRemaining } = prescriptionAlertDataSchema.parse(data);
  const date = getSaoPauloTime(endDate).toLocaleDateString('pt-BR');
  const title = '📋 Alerta de Prescrição';

  let richMsg = '';
  let plainMsg = '';
  if (daysRemaining === 1) {
    richMsg = `⚠️ *Sua prescrição vence amanhã\\.!*\n\n`;
    plainMsg = `⚠️ Sua prescrição vence amanhã!\n`;
  } else if (daysRemaining <= 7) {
    richMsg = `⚠️ *Prescrição vencendo em ${daysRemaining} dias*\n\n`;
    plainMsg = `⚠️ Prescrição vencendo em ${daysRemaining} dias\n`;
  } else {
    richMsg = `📋 *Renovação de Prescrição*\n\n`;
    plainMsg = `📋 Renovação de Prescrição\n`;
  }

  const info = `Medicamento: ${medicineName}\n` + `Vencimento: ${date}\n\n`;
  richMsg += escapeMarkdownV2(info);
  plainMsg += info;

  let footer = '';
  let plainFooter = '';
  if (daysRemaining <= 7) {
    footer = `🚨 *Atenção\\.!* Renove sua prescrição o quanto antes para evitar interrupção no tratamento\\.`;
    plainFooter = `🚨 Atenção! Renove sua prescrição o quanto antes para evitar interrupção no tratamento.`;
  } else {
    footer = `💡 É um bom momento para agendar sua consulta de acompanhamento para renovação\\.`;
    plainFooter = `💡 É um bom momento para agendar sua consulta de acompanhamento para renovação.`;
  }
  
  richMsg += footer;
  plainMsg += plainFooter;

  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildDlqDigestPayload(data) {
  const { failedCount, failures } = dlqDigestDataSchema.parse(data);
  const title = '⚠️ DLQ Digest';
  
  let richMsg = `*${failedCount} notificações falhadas*\n\n`;
  let plainMsg = `${failedCount} notificações falhadas\n\n`;
  
  const items = failures.map(f => {
    const localTime = getSaoPauloTime(f.created_at);
    const time = localTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const error = (f.error_message || 'Erro desconhecido').substring(0, 50);
    return {
      rich: `• [${time}] *${escapeMarkdownV2(f.type)}*: _${escapeMarkdownV2(error)}_`,
      plain: `• [${time}] ${f.type}: ${error}`
    };
  });

  richMsg += items.map(i => i.rich).join('\n');
  plainMsg += items.map(i => i.plain).join('\n');
  
  return { title, body: richMsg, pushBody: plainMsg };
}
