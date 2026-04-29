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
  let metadata = { ...data, kind: validatedKind };

  switch (validatedKind) {
    case 'daily_digest': {
      const { firstName, hour, pendingCount, medicines } = dailyDigestDataSchema.parse(data);
      const greeting = getGreeting(hour);
      title = '📅 Resumo do Dia';
      
      let msg = `${greeting}, *${escapeMarkdownV2(firstName)}*\\!\\n\\n`;
      
      if (pendingCount > 0) {
        msg += `Você tem *${pendingCount}* ${pendingCount === 1 ? 'dose pendente' : 'doses pendentes'} para hoje:\\n\\n`;
        medicines.forEach(m => {
          msg += `💊 *${escapeMarkdownV2(m.name)}*\\n`;
          msg += `⏰ ${escapeMarkdownV2(m.time)}${m.dosage ? ` \\(${escapeMarkdownV2(m.dosage)}\\)` : ''}\\n\\n`;
        });
        msg += `Não se esqueça de registrar no app\\!`;
      } else {
        msg += `Você está em dia com todos os seus medicamentos de hoje\\! 🎉`;
      }
      
      body = msg;
      break;
    }

    case 'adherence_report': {
      const { firstName, period, percentage, taken, total, storytelling } = adherenceReportDataSchema.parse(data);
      const nudge = getMotivationalNudge(percentage);
      title = '📈 Relatório de Adesão';
      
      let msg = `Olá, *${escapeMarkdownV2(firstName)}*\\!\\n\\n`;
      msg += `Sua adesão ${escapeMarkdownV2(period)} foi de *${percentage}%*\\n`;
      msg += `✅ *${taken}* de *${total}* doses registradas\\.\\n\\n`;
      
      if (storytelling) {
        msg += `📈 *Comparação:* ${escapeMarkdownV2(storytelling)}\\n\\n`;
      }
      
      msg += `_${escapeMarkdownV2(nudge)}_`;
      
      body = msg;
      break;
    }

    case 'dose_reminder': {
      const medicineName = escapeMarkdownV2(data.medicineName || 'Medicamento');
      const time = escapeMarkdownV2(data.time || '');
      title = '💊 Hora do Medicamento';
      body = `Está na hora de tomar *${medicineName}* \\(${time}\\)\\.`;
      break;
    }

    case 'dose_reminder_by_plan': {
      const n = data.doses?.length ?? 0;
      const planName = data.planName ?? 'Plano de tratamento';
      const scheduledTime = data.scheduledTime ?? 'agora';
      const hour = data.hour ?? new Date().getHours();
      
      title = `${getTimeOfDayGreeting(hour)} — ${escapeMarkdownV2(planName)}`;
      body = `Está na hora de tomar ${n} medicamento${n !== 1 ? 's' : ''} do seu plano \\(${escapeMarkdownV2(scheduledTime)}\\)\\.`;
      break;
    }

    case 'dose_reminder_misc': {
      const n = data.doses?.length ?? 0;
      const scheduledTime = data.scheduledTime ?? 'agora';
      const hour = data.hour ?? new Date().getHours();
      
      title = getTimeOfDayGreeting(hour);
      body = `Você tem ${n} medicamento${n !== 1 ? 's' : ''} pendente${n !== 1 ? 's' : ''} para ${escapeMarkdownV2(scheduledTime)}\\. Clique para registrar\\.`;
      break;
    }

    case 'stock_alert': {
      const { medicineName, remaining, daysRemaining } = stockAlertDataSchema.parse(data);
      title = `📦 Alerta de Estoque: ${escapeMarkdownV2(medicineName)}`;
      
      let msg = `📉 **Restam:** ${remaining} doses\\.\n`;
      if (daysRemaining !== undefined) {
        msg += `⏳ **Previsão:** Acaba em aproximadamente **${daysRemaining} dias**\\.\n\n`;
      }
      msg += `Recomendamos a reposição em breve\\.`;
      
      body = msg;
      break;
    }

    case 'titration_alert': {
      const { medicineName, currentStage, totalStages, status, nextStage } = titrationAlertDataSchema.parse(data);
      const name = escapeMarkdownV2(medicineName);
      title = '🎯 Atualização de Titulação';

      let msg = `🎯 *Atualização de Titulação*\n\n`;
      msg += `Medicamento: **${name}**\n`;
      msg += `Etapa atual: ${currentStage}/${totalStages}\n\n`;

      if (status === 'alvo_atingido') {
        msg += `✅ *Parabéns\\!* Você atingiu a dose alvo\\!\n`;
        msg += `Continue com o acompanhamento médico\\.`;
      } else if (status === 'titulando' && nextStage) {
        msg += `📈 Próxima etapa: ${escapeMarkdownV2(nextStage.dosage)} ${escapeMarkdownV2(nextStage.unit)}\n`;
        msg += `⏰ Data prevista: ${escapeMarkdownV2(nextStage.date || 'a definir')}`;
      }

      body = msg;
      break;
    }

    case 'monthly_report': {
      const { firstName, percentage, taken, total } = adherenceReportDataSchema.parse(data);
      const name = escapeMarkdownV2(firstName);
      title = '🗓️ Relatório Mensal';
      
      let msg = `📊 *Seu Relatório Mensal*\n\n`;
      msg += `Olá ${name}, sua taxa de adesão no último mês foi de **${percentage}%**\\.\n`;
      msg += `✅ **Doses tomadas:** ${taken}\n`;
      msg += `📝 **Doses esperadas:** ${total}\n\n`;
      
      if (percentage >= 90) msg += `🚀 *Desempenho excepcional\\!* Continue assim\\.`;
      else if (percentage >= 70) msg += `💪 *Bom trabalho\\!* Vamos buscar os 100% no próximo mês?`;
      else msg += `💡 *Lembrete:* Manter a constância é fundamental para o sucesso do tratamento\\.`;
      
      body = msg;
      break;
    }

    case 'prescription_alert': {
      const { medicineName, endDate, daysRemaining } = prescriptionAlertDataSchema.parse(data);
      const name = escapeMarkdownV2(medicineName);
      const date = escapeMarkdownV2(new Date(endDate).toLocaleDateString('pt-BR'));
      title = '📋 Alerta de Prescrição';

      let msg = '';
      if (daysRemaining === 1) {
        msg = `⚠️ *Sua prescrição vence amanhã\\!*\n\n`;
      } else if (daysRemaining <= 7) {
        msg = `⚠️ *Prescrição vencendo em ${daysRemaining} dias*\n\n`;
      } else {
        msg = `📋 *Renovação de Prescrição*\n\n`;
      }

      msg += `Medicamento: **${name}**\n`;
      msg += `Vencimento: ${date}\n\n`;

      if (daysRemaining <= 7) {
        msg += `🚨 *Atenção\\!* Renove sua prescrição o quanto antes para evitar interrupção no tratamento\\.`;
      } else {
        msg += `💡 É um bom momento para agendar sua consulta de acompanhamento para renovação\\.`;
      }

      body = msg;
      break;
    }

    case 'dlq_digest': {
      const { failedCount, failures } = dlqDigestDataSchema.parse(data);
      title = '⚠️ DLQ Digest';
      body = `*${failedCount} notificações falhadas*\n\n`;
      
      body += failures.map(f => {
        const time = new Date(f.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const error = (f.error_message || 'Erro desconhecido').substring(0, 50);
        return `• [${time}] *${escapeMarkdownV2(f.type)}*: _${escapeMarkdownV2(error)}_`;
      }).join('\n');
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
    body = `${body}\n\n_Esta é uma nova tentativa de envio\\._`;
  }

  // Validação do Contrato de Saída (Gate L2 -> L3)
  return notificationPayloadSchema.parse({
    title,
    body,
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
