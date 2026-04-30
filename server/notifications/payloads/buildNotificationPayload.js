// Constrói payload canônico de notificação a partir de evento de domínio
// Todos os canais (Telegram, Expo) consomem este shape normalizado

import { z } from 'zod';
import { escapeMarkdownV2 } from '../../utils/formatters.js';
import { getGreeting, getMotivationalNudge, getTimeOfDayGreeting } from '../../bot/utils/notificationHelpers.js';

/**
 * Schemas de contrato para os dados de entrada (Layer 1 -> Layer 2)
 */
export const dailyDigestDataSchema = z.object({
  firstName: z.string(),
  hour: z.number().min(0).max(23),
  pendingCount: z.number(),
  medicines: z.array(z.object({
    name: z.string(),
    time: z.string(),
    dosage: z.string().optional()
  }))
});

export const adherenceReportDataSchema = z.object({
  firstName: z.string(),
  period: z.string(), // ex: "hoje", "esta semana"
  percentage: z.number().min(0).max(100),
  taken: z.number(),
  total: z.number(),
  storytelling: z.string().optional() // Insights comparativos vindos da L1
});

export const stockAlertDataSchema = z.object({
  medicineName: z.string(),
  remaining: z.number(),
  daysRemaining: z.number().optional()
});

export const titrationAlertDataSchema = z.object({
  medicineName: z.string(),
  currentStage: z.number(),
  totalStages: z.number(),
  status: z.enum(['alvo_atingido', 'titulando']),
  nextStage: z.object({
    dosage: z.string(),
    unit: z.string(),
    date: z.string().optional()
  }).optional()
});

export const prescriptionAlertDataSchema = z.object({
  medicineName: z.string(),
  endDate: z.string(),
  daysRemaining: z.number()
});

export const dlqDigestDataSchema = z.object({
  failedCount: z.number(),
  failures: z.array(z.object({
    id: z.string(),
    type: z.string(),
    error_message: z.string().optional(),
    created_at: z.string()
  }))
});

export const kindSchema = z.enum([
  'dose_reminder',
  'dose_reminder_by_plan',
  'dose_reminder_misc',
  'stock_alert',
  'daily_digest',
  'adherence_report',
  'monthly_report',
  'titration_alert',
  'prescription_alert',
  'dlq_digest'
]);

// Contrato de saída da Presentation Layer (L2) para a Delivery Layer (L3)
export const notificationPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  pushBody: z.string(), // Texto puro sem escapes para Push/Alerts (R-205)
  deeplink: z.string().startsWith('dosiq://'), // Garante padrão de deep linking do app
  metadata: z.object({
    kind: kindSchema,
  }).passthrough()
});

/**
 * Centralizador de construção de payloads de notificação.
 * Garante que todas as mensagens sigam o mesmo padrão visual e de escape.
 * 
 * @param {object} params - Parâmetros da notificação
 * @param {string} params.kind - Tipo da notificação
 * @param {object} params.data - Dados específicos para o tipo
 * @returns {object} Payload formatado { title, body, deeplink, metadata }
 */
export function buildNotificationPayload({ kind, data }) {
  // 1. Validar Kind
  const validatedKind = kindSchema.parse(kind);

  let title = '';
  let body = '';
  let pushBody = '';
  let metadata = { ...data, kind: validatedKind };

  switch (validatedKind) {
    case 'daily_digest': {
      const { firstName, hour, pendingCount, medicines } = dailyDigestDataSchema.parse(data);
      const greeting = getGreeting(hour);
      title = '📅 Resumo do Dia';
      
      const safeName = escapeMarkdownV2(firstName);
      
      // Versão Rich (Telegram/Inbox)
      let richMsg = `${greeting}, *${safeName}*\\!

`;
      // Versão Plain (Push)
      let plainMsg = `${greeting}, ${firstName}! `;
      
      if (pendingCount > 0) {
        const text = pendingCount === 1 ? 'dose pendente' : 'doses pendentes';
        richMsg += `Você tem *${pendingCount}* ${text} para hoje:

`;
        plainMsg += `Você tem ${pendingCount} ${text} para hoje:
`;
        
        medicines.forEach(m => {
          richMsg += `💊 *${escapeMarkdownV2(m.name)}*
`;
          richMsg += `⏰ ${escapeMarkdownV2(m.time)}${m.dosage ? ` \\(${escapeMarkdownV2(m.dosage)}\\)` : ''}

`;
          
          plainMsg += `⏰ ${m.name} - ${m.time}${m.dosage ? ` (${m.dosage})` : ''}
`;
        });
        richMsg += `Não se esqueça de registrar no app\\!`;
        plainMsg += `Não se esqueça de registrar no app!`;
      } else {
        const success = `Você está em dia com todos os seus medicamentos de hoje\\! 🎉`;
        richMsg += success;
        plainMsg += success.replace(/\\/g, '');
      }
      
      body = richMsg;
      pushBody = plainMsg;
      break;
    }

    case 'adherence_report': {
      const { firstName, period, percentage, taken, total, storytelling } = adherenceReportDataSchema.parse(data);
      const nudge = getMotivationalNudge(percentage);
      title = '📈 Relatório diário';
      
      const safeName = escapeMarkdownV2(firstName);
      const safePeriod = escapeMarkdownV2(period);
      
      // Versão Rich
      let richMsg = `Olá, *${safeName}*\\!

`;
      richMsg += `Sua adesão ${safePeriod} foi de *${percentage}%*
`;
      richMsg += `✅ *${taken}* de *${total}* doses registradas\\.

`;
      
      // Versão Plain
      let plainMsg = `Olá, ${firstName}! 
`;
      plainMsg += `Sua adesão ${period} foi de ${percentage}% `;
      plainMsg += `✅ ${taken} de ${total} doses registradas.
`;
      
      if (storytelling) {
        richMsg += `*Comparação:* ${escapeMarkdownV2(storytelling)}

`;
        plainMsg += `Comparação: 
`;
        plainMsg += `${storytelling} `;
      }
      
      richMsg += `_${escapeMarkdownV2(nudge)}_`;
      plainMsg += nudge;
      
      body = richMsg;
      pushBody = plainMsg;
      break;
    }

    case 'dose_reminder': {
      const medicineName = data.medicineName || 'Medicamento';
      const time = data.time || '';
      title = '💊 Hora do Medicamento';
      body = `Está na hora de tomar *${escapeMarkdownV2(medicineName)}* \\(${escapeMarkdownV2(time)}\\)${data.dosage ? ` — **${escapeMarkdownV2(data.dosage)}**` : ''}\\.`;
      pushBody = `Está na hora de tomar ${medicineName} (${time})${data.dosage ? ` — ${data.dosage}` : ''}.`;
      break;
    }

    case 'dose_reminder_by_plan': {
      const n = data.doses?.length ?? 0;
      const planName = data.planName ?? 'Plano de tratamento';
      const scheduledTime = data.scheduledTime ?? 'agora';
      const hour = data.hour ?? new Date().getHours();
      
      const greeting = getTimeOfDayGreeting(hour);
      title = `${greeting} — ${planName}`;
      
      body = `Está na hora de tomar ${n} medicamento${n !== 1 ? 's' : ''} do seu plano \\(${escapeMarkdownV2(scheduledTime)}\\)\\.`;
      pushBody = `Está na hora de tomar ${n} medicamento${n !== 1 ? 's' : ''} do seu plano (${scheduledTime}).`;
      break;
    }

    case 'dose_reminder_misc': {
      const n = data.doses?.length ?? 0;
      const scheduledTime = data.scheduledTime ?? 'agora';
      const hour = data.hour ?? new Date().getHours();
      
      title = getTimeOfDayGreeting(hour);
      body = `Você tem ${n} medicamento${n !== 1 ? 's' : ''} pendente${n !== 1 ? 's' : ''} para ${escapeMarkdownV2(scheduledTime)}\\. Clique para registrar\\.`;
      pushBody = `Você tem ${n} medicamento${n !== 1 ? 's' : ''} pendente${n !== 1 ? 's' : ''} para ${scheduledTime}. Clique para registrar.`;
      break;
    }

    case 'stock_alert': {
      const { medicineName, remaining, daysRemaining } = stockAlertDataSchema.parse(data);
      title = `📦 Alerta de Estoque: ${medicineName}`;
      
      let richMsg = `📉 **Restam:** ${remaining} doses\\..
`;
      let plainMsg = `📉 Restam: ${remaining} doses.
`;
      
      if (daysRemaining !== undefined) {
        richMsg += `⏳ **Previsão:** Acaba em aproximadamente **${daysRemaining} dias**\\.

`;
        plainMsg += `⏳ Previsão: Acaba em aproximadamente ${daysRemaining} dias.

`;
      }
      
      const footer = `Recomendamos a reposição em breve\\.`;
      richMsg += footer;
      plainMsg += footer.replace(/\\\\/g, '');
      
      body = richMsg;
      pushBody = plainMsg;
      break;
    }

    case 'titration_alert': {
      const { medicineName, currentStage, totalStages, status, nextStage } = titrationAlertDataSchema.parse(data);
      title = '🎯 Atualização de Titulação';

      let richMsg = `🎯 *Atualização de Titulação*

`;
      richMsg += `Medicamento: **${escapeMarkdownV2(medicineName)}**
`;
      richMsg += `Etapa atual: ${currentStage}/${totalStages}

`;

      let plainMsg = `🎯 Atualização de Titulação
`;
      plainMsg += `Medicamento: ${medicineName}
`;
      plainMsg += `Etapa atual: ${currentStage}/${totalStages}

`;

      if (status === 'alvo_atingido') {
        const success = `✅ *Parabéns\\!* Você atingiu a dose alvo\\!
Continue com o acompanhamento médico\\.`;
        const plainSuccess = `✅ Parabéns! Você atingiu a dose alvo!
Continue com o acompanhamento médico.`;
        richMsg += success;
        plainMsg += plainSuccess;
      } else if (status === 'titulando' && nextStage) {
        richMsg += `📈 Próxima etapa: ${escapeMarkdownV2(nextStage.dosage)} ${escapeMarkdownV2(nextStage.unit)}
`;
        richMsg += `⏰ Data prevista: ${escapeMarkdownV2(nextStage.date || 'a definir')}`;
        
        plainMsg += `📈 Próxima etapa: ${nextStage.dosage} ${nextStage.unit}
`;
        plainMsg += `⏰ Data prevista: ${nextStage.date || 'a definir'}`;
      }

      body = richMsg;
      pushBody = plainMsg;
      break;
    }

    case 'monthly_report': {
      const { firstName, percentage, taken, total } = adherenceReportDataSchema.parse(data);
      title = '🗓️ Relatório Mensal';
      
      let richMsg = `📊 *Seu Relatório Mensal*

`;
      richMsg += `Olá ${escapeMarkdownV2(firstName)}, sua taxa de adesão no último mês foi de **${percentage}%**\\..
`;
      richMsg += `✅ **Doses tomadas:** ${taken}
`;
      richMsg += `📝 **Doses esperadas:** ${total}

`;
      
      let plainMsg = `📊 Seu Relatório Mensal
`;
      plainMsg += `Olá ${firstName}, sua taxa de adesão no último mês foi de ${percentage}%.
`;
      plainMsg += `✅ Doses tomadas: ${taken}
`;
      plainMsg += `📝 Doses esperadas: ${total}

`;
      
      let nudge = '';
      if (percentage >= 90) nudge = `🚀 *Desempenho excepcional\\.!* Continue assim\\.`;
      else if (percentage >= 70) nudge = `💪 *Bom trabalho\\.!* Vamos buscar os 100% no próximo mês?`;
      else nudge = `💡 *Lembrete:* Manter a constância é fundamental para o sucesso do tratamento\\.`;
      
      richMsg += nudge;
      plainMsg += nudge.replace(/[\\.\\.]/g, '').replace(/\\./g, '');
      
      body = richMsg;
      pushBody = plainMsg;
      break;
    }

    case 'prescription_alert': {
      const { medicineName, endDate, daysRemaining } = prescriptionAlertDataSchema.parse(data);
      const date = new Date(endDate).toLocaleDateString('pt-BR');
      title = '📋 Alerta de Prescrição';

      let richMsg = '';
      let plainMsg = '';
      if (daysRemaining === 1) {
        richMsg = `⚠️ *Sua prescrição vence amanhã\\.!*

`;
        plainMsg = `⚠️ Sua prescrição vence amanhã!
`;
      } else if (daysRemaining <= 7) {
        richMsg = `⚠️ *Prescrição vencendo em ${daysRemaining} dias*

`;
        plainMsg = `⚠️ Prescrição vencendo em ${daysRemaining} dias
`;
      } else {
        richMsg = `📋 *Renovação de Prescrição*

`;
        plainMsg = `📋 Renovação de Prescrição
`;
      }

      const info = `Medicamento: ${medicineName}
Vencimento: ${date}

`;
      richMsg += escapeMarkdownV2(info);
      plainMsg += info;

      let footer = '';
      if (daysRemaining <= 7) {
        footer = `🚨 *Atenção\\.!* Renove sua prescrição o quanto antes para evitar interrupção no tratamento\\.`;
      } else {
        footer = `💡 É um bom momento para agendar sua consulta de acompanhamento para renovação\\.`;
      }
      
      richMsg += footer;
      plainMsg += footer.replace(/[\\.\\.]/g, '').replace(/\\./g, '');

      body = richMsg;
      pushBody = plainMsg;
      break;
    }

    case 'dlq_digest': {
      const { failedCount, failures } = dlqDigestDataSchema.parse(data);
      title = '⚠️ DLQ Digest';
      
      let richMsg = `*${failedCount} notificações falhadas*

`;
      let plainMsg = `${failedCount} notificações falhadas

`;
      
      const items = failures.map(f => {
        const time = new Date(f.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const error = (f.error_message || 'Erro desconhecido').substring(0, 50);
        return {
          rich: `• [${time}] *${escapeMarkdownV2(f.type)}*: _${escapeMarkdownV2(error)}_`,
          plain: `• [${time}] ${f.type}: ${error}`
        };
      });

      richMsg += items.map(i => i.rich).join('\n');
      plainMsg += items.map(i => i.plain).join('\n');
      
      body = richMsg;
      pushBody = plainMsg;
      break;
    }

    default:
      throw new Error(`Unsupported notification kind: ${kind}`);
  }

  // 3. Resolver Deeplink lógico (Responsabilidade da Layer 2)
  const deeplink = resolveDeeplink(validatedKind, data);

  // 4. Aplicar Decoração de Reenvio (Gate 3.5)
  if (data.isRetry) {
    title = `🔄 ${title} (Reenvio)`;
    body = `${body}

_Esta é uma nova tentativa de envio\\._`;
    pushBody = `${pushBody}

(Reenvio)`;
  }

  // Validação do Contrato de Saída (Gate L2 -> L3)
  return notificationPayloadSchema.parse({
    title,
    body,
    pushBody,
    deeplink,
    metadata: {
      ...metadata,
      builtAt: new Date().toISOString()
    }
  });
}

/**
 * Resolve o deeplink canônico para cada tipo de notificação.
 * Centraliza a lógica de rotas e parâmetros.
 */
function resolveDeeplink(kind, data) {
  const BASE_URL = 'dosiq://';
  
  // 1. Mapeamento de rotas estáticas
  const staticRoutes = {
    adherence_report: 'history',
    monthly_report: 'history',
    stock_alert: 'stock',
    prescription_alert: 'stock',
    dlq_digest: 'admin/dlq'
  };

  if (staticRoutes[kind]) {
    return `${BASE_URL}${staticRoutes[kind]}`;
  }

  // 2. Rotas dinâmicas com parâmetros
  switch (kind) {
    case 'dose_reminder':
      return data.protocolId 
        ? `${BASE_URL}today?protocolId=${data.protocolId}` 
        : `${BASE_URL}today`;

    case 'dose_reminder_by_plan':
      return data.planId
        ? `${BASE_URL}today?bulkMode=plan&planId=${data.planId}&at=${data.scheduledTime || 'now'}`
        : `${BASE_URL}today`;

    case 'dose_reminder_misc':
      return `${BASE_URL}today?bulkMode=misc&at=${data.scheduledTime || 'now'}`;

    default:
      return `${BASE_URL}today`;
  }
}
