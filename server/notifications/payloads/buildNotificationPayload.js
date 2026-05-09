// Constrói payload canônico de notificação a partir de evento de domínio
// Todos os canais (Telegram, Expo) consomem este shape normalizado

import { 
  getServerTimestamp 
} from '../../utils/dateUtils.js';

import {
  kindSchema,
  notificationPayloadSchema,
  actionSchema,
  metadataSchema
} from './_payloadSchemas.js';

export { kindSchema, notificationPayloadSchema, actionSchema, metadataSchema };

import {
  buildDailyDigestPayload,
  buildAdherenceReportPayload,
  buildDoseReminderPayload,
  buildDoseReminderByPlanPayload,
  buildDoseReminderMiscPayload,
  buildStockAlertPayload,
  buildTitrationAlertPayload,
  buildMonthlyReportPayload,
  buildPrescriptionAlertPayload,
  buildDlqDigestPayload
} from './_payloadBuilders.js';

/**
 * Centralizador de construção de payloads de notificação.
 * Garante que todas as mensagens sigam o mesmo padrão visual e de escape.
 * 
 * @param {object} params - Parâmetros da notificação
 * @param {string} params.kind - Tipo da notificação
 * @param {object} params.data - Dados específicos para o tipo
 * @returns {object} Payload formatado { title, body, deeplink, metadata }
 */
export function buildNotificationPayload({ kind, data, context = {} }) {
  // 1. Validar Kind
  const validatedKind = kindSchema.parse(kind);

  let payloadContent;
  let actions = [];

  switch (validatedKind) {
    case 'daily_digest':
      payloadContent = buildDailyDigestPayload(data);
      break;
    case 'adherence_report':
      payloadContent = buildAdherenceReportPayload(data);
      break;
    case 'dose_reminder':
      payloadContent = buildDoseReminderPayload(data);
      break;
    case 'dose_reminder_by_plan':
      payloadContent = buildDoseReminderByPlanPayload(data);
      break;
    case 'dose_reminder_misc':
      payloadContent = buildDoseReminderMiscPayload(data);
      break;
    case 'stock_alert':
      payloadContent = buildStockAlertPayload(data);
      break;
    case 'titration_alert':
      payloadContent = buildTitrationAlertPayload(data);
      break;
    case 'monthly_report':
      payloadContent = buildMonthlyReportPayload(data);
      break;
    case 'prescription_alert':
      payloadContent = buildPrescriptionAlertPayload(data);
      break;
    case 'dlq_digest':
      payloadContent = buildDlqDigestPayload(data);
      break;
    default:
      throw new Error(`Unsupported notification kind: ${kind}`);
  }

  // 2. Resolver Deeplink lógico (Responsabilidade da Layer 2)
  const deeplink = resolveDeeplink(validatedKind, data);

  // 3. Aplicar Decoração de Reenvio (Gate 1 — Shim de transição)
  const decorated = applyRetryDecoration(payloadContent, context, data);

  // Validação do Contrato de Saída (Gate L2 -> L3)
  return notificationPayloadSchema.parse({
    ...decorated,
    deeplink,
    actions,
    metadata: buildMetadata(validatedKind, context)
  });
}

/**
 * Aplica decoração visual de reenvio se necessário.
 * Isolado para reduzir complexidade da função principal.
 */
function applyRetryDecoration(content, context, data) {
  const isRetry = context.isRetry ?? data.isRetry ?? false;
  if (!isRetry) return content;

  return {
    ...content,
    title: `🔄 ${content.title} (Reenvio)`,
    body: `${content.body}\n\n_Esta é uma nova tentativa de envio\\._`,
    pushBody: `${content.pushBody}\n\n(Reenvio)`
  };
}

/**
 * Constrói objeto de metadados estrito conforme contrato.
 */
function buildMetadata(kind, context) {
  return {
    kind,
    builtAt: getServerTimestamp(),
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    ...(context.details ? { details: context.details } : {})
  };
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
