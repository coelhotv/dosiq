// Constrói payload canônico de notificação a partir de evento de domínio
// Todos os canais (Telegram, Expo) consomem este shape normalizado

import { z } from 'zod';
import { escapeMarkdownV2 } from '../../utils/formatters.js';
import { getGreeting, getMotivationalNudge } from '../../bot/utils/notificationHelpers.js';

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
  total: z.number()
});

export const kindSchema = z.enum([
  'dose_reminder',
  'dose_reminder_by_plan',
  'dose_reminder_misc',
  'stock_alert',
  'daily_digest',
  'adherence_report'
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
      const { firstName, period, percentage, taken, total } = adherenceReportDataSchema.parse(data);
      const nudge = getMotivationalNudge(percentage);
      title = '📈 Relatório de Adesão';
      
      let msg = `Olá, *${escapeMarkdownV2(firstName)}*\\!\\n\\n`;
      msg += `Sua adesão ${escapeMarkdownV2(period)} foi de *${percentage}%*\\n`;
      msg += `✅ *${taken}* de *${total}* doses registradas\\.\\n\\n`;
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
      title = `💊 ${escapeMarkdownV2(planName)}`;
      body = `Está na hora de tomar ${n} medicamento${n !== 1 ? 's' : ''} \\(${escapeMarkdownV2(scheduledTime)}\\)\\.`;
      break;
    }

    case 'dose_reminder_misc': {
      const n = data.doses?.length ?? 0;
      const scheduledTime = data.scheduledTime ?? 'agora';
      title = '💊 Hora dos Medicamentos';
      body = `Você tem ${n} medicamento${n !== 1 ? 's' : ''} agendado${n !== 1 ? 's' : ''} para ${escapeMarkdownV2(scheduledTime)}\\.`;
      break;
    }

    case 'stock_alert': {
      const medicineName = escapeMarkdownV2(data.medicineName || 'Medicamento');
      const remaining = data.remaining || 0;
      title = '⚠️ Alerta de Estoque';
      body = `Seu estoque de *${medicineName}* está acabando\\. Restam apenas *${remaining}* doses\\.`;
      break;
    }

    default:
      throw new Error(`Unsupported notification kind: ${kind}`);
  }

  // 3. Resolver Deeplink lógico (Responsabilidade da Layer 2)
  let deeplink = 'dosiq://today';
  if (validatedKind === 'adherence_report') deeplink = 'dosiq://history';
  if (validatedKind === 'stock_alert') deeplink = 'dosiq://stock';
  if (validatedKind === 'dose_reminder' && data.protocolId) {
    deeplink = `dosiq://today?protocolId=${data.protocolId}`;
  }
  if (validatedKind === 'dose_reminder_by_plan' && data.planId) {
    deeplink = `dosiq://today?bulkMode=plan&planId=${data.planId}&at=${data.scheduledTime || 'now'}`;
  }
  if (validatedKind === 'dose_reminder_misc') {
    deeplink = `dosiq://today?bulkMode=misc&at=${data.scheduledTime || 'now'}`;
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
