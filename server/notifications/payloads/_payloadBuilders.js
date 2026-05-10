import { 
  dailyDigestDataSchema, 
  adherenceReportDataSchema, 
  stockAlertDataSchema, 
  titrationAlertDataSchema, 
  prescriptionAlertDataSchema, 
  dlqDigestDataSchema,
  doseReminderDataSchema
} from './_payloadSchemas.js';
import { escapeMarkdownV2 } from '../../utils/formatters.js';
import { getGreeting, getMotivationalNudge, getTimeOfDayGreeting } from '../../bot/utils/notificationHelpers.js';
import { getSaoPauloTime } from '../../utils/dateUtils.js';

const formatDose = (qty, unit) => {
  if (!qty) return undefined;
  const u = unit?.toLowerCase() || 'cp';
  if (['mg', 'mcg', 'g', 'ml'].includes(u)) {
    return '1 cp';
  }
  return `${qty} ${u}`;
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
      const displayDosage = formatDose(m.dosagePerIntake, m.dosageUnit);
      richMsg += `💊 *${escapeMarkdownV2(m.name)}*\n`;
      richMsg += `⏰ ${escapeMarkdownV2(m.time)}${displayDosage ? ` \\(${escapeMarkdownV2(displayDosage)}\\)` : ''}\n\n`;
      plainMsg += `⏰ ${m.name} - ${m.time}${displayDosage ? ` (${displayDosage})` : ''}\n`;
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
    const trendText = trend === 'up'
      ? `Melhora de ${deltaPercent}% vs ontem`
      : trend === 'down'
      ? `Queda de ${deltaPercent}% vs ontem`
      : `Estável vs ontem`;

    richMsg += `*Comparação:* ${trendEmoji} ${escapeMarkdownV2(trendText)}\n\n`;
    plainMsg += `Comparação: ${trendEmoji} ${trendText}\n`;
  }
  
  richMsg += `_${escapeMarkdownV2(nudge)}_`;
  plainMsg += nudge;
  
  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildDoseReminderPayload(data) {
  const { medicineName, time, dosagePerIntake, dosageUnit } = doseReminderDataSchema.parse(data);
  const title = '💊 Hora do Medicamento';
  const displayDosage = formatDose(dosagePerIntake, dosageUnit);
  
  const body = `Está na hora de tomar *${escapeMarkdownV2(medicineName)}* \\(${escapeMarkdownV2(time)}\\)${displayDosage ? ` — **${escapeMarkdownV2(displayDosage)}**` : ''}\\.`;
  const pushBody = `Está na hora de tomar ${medicineName} (${time})${displayDosage ? ` — ${displayDosage}` : ''}.`;
  return { title, body, pushBody };
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
  
  let richMsg = `📉 **Restam:** ${remaining} doses\\..\n`;
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

export function buildTitrationAlertPayload(data) {
  const { medicineName, currentStage, totalStages, status, nextStage } = titrationAlertDataSchema.parse(data);
  const title = '🎯 Atualização de Titulação';

  let richMsg = `🎯 *Atualização de Titulação*\n\n`;
  richMsg += `Medicamento: **${escapeMarkdownV2(medicineName)}**\n`;
  richMsg += `Etapa atual: ${currentStage}/${totalStages}\n\n`;

  let plainMsg = `🎯 Atualização de Titulação\n`;
  plainMsg += `Medicamento: ${medicineName}\n`;
  plainMsg += `Etapa atual: ${currentStage}/${totalStages}\n\n`;

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
  richMsg += `Olá ${escapeMarkdownV2(firstName)}, sua taxa de adesão no último mês foi de **${percentage}%**\\..\n`;
  richMsg += `✅ **Doses tomadas:** ${taken}\n`;
  richMsg += `📝 **Doses esperadas:** ${total}\n\n`;
  
  let plainMsg = `📊 Seu Relatório Mensal\n`;
  plainMsg += `Olá ${firstName}, sua taxa de adesão no último mês foi de ${percentage}%.\n`;
  plainMsg += `✅ Doses tomadas: ${taken}\n`;
  plainMsg += `📝 Doses esperadas: ${total}\n\n`;
  
  let nudge = '';
  let plainNudge = '';
  if (percentage >= 90) { nudge = `🚀 *Desempenho excepcional\\.!* Continue assim\\.`; plainNudge = `🚀 Desempenho excepcional! Continue assim.`; }
  else if (percentage >= 70) { nudge = `💪 *Bom trabalho\\.!* Vamos buscar os 100% no próximo mês?`; plainNudge = `💪 Bom trabalho! Vamos buscar os 100% no próximo mês?`; }
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
