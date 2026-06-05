// Constrói payload canônico de notificação a partir de evento de domínio
// Todos os canais (Telegram, Expo) consomem este shape normalizado

import { 
  getServerTimestamp 
} from '../../utils/dateUtils.js';

import { escapeMarkdownV2 } from '../../utils/formatters.js';

import { 
  getTimeOfDayGreeting, 
  getTimeOfDayEmoji 
} from '../../bot/utils/notificationHelpers.js';

import {
  kindSchema,
  notificationPayloadSchema,
  actionSchema,
  metadataSchema,
  doseReminderDataSchema,
  doseReminderByPlanDataSchema,
  doseReminderMiscDataSchema
} from './_payloadSchemas.js';

export { kindSchema, notificationPayloadSchema, actionSchema, metadataSchema };

import {
  buildDailyDigestPayload,
  buildAdherenceReportPayload,
  buildWeeklyAdherencePayload,
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

  const metadata = buildMetadata(validatedKind, context, data);
  let title, body, pushBody;
  let actions = [];

  switch (validatedKind) {
    case 'daily_digest': {
      const content = buildDailyDigestPayload(data);
      title = content.title;
      body = content.body;
      pushBody = content.pushBody;
      break;
    }
    case 'adherence_report': {
      const content = buildAdherenceReportPayload(data);
      title = content.title;
      body = content.body;
      pushBody = content.pushBody;
      break;
    }
    case 'weekly_adherence': {
      const content = buildWeeklyAdherencePayload(data);
      title = content.title;
      body = content.body;
      pushBody = content.pushBody;
      break;
    }
    case 'dose_reminder': {
      const formatted = formatDoseReminder(data, metadata);
      title = formatted.title;
      body = formatted.body;
      pushBody = formatted.pushBody;
      actions = formatted.actions;
      break;
    }
    case 'dose_reminder_by_plan': {
      const formatted = formatDoseReminderByPlan(data, metadata);
      title = formatted.title;
      body = formatted.body;
      pushBody = formatted.pushBody;
      actions = formatted.actions;
      break;
    }
    case 'dose_reminder_misc': {
      const formatted = formatDoseReminderMisc(data, metadata);
      title = formatted.title;
      body = formatted.body;
      pushBody = formatted.pushBody;
      actions = formatted.actions;
      break;
    }
    case 'stock_alert': {
      const content = buildStockAlertPayload(data);
      title = content.title;
      body = content.body;
      pushBody = content.pushBody;
      break;
    }
    case 'titration_alert': {
      const content = buildTitrationAlertPayload(data);
      title = content.title;
      body = content.body;
      pushBody = content.pushBody;
      break;
    }
    case 'monthly_report': {
      const content = buildMonthlyReportPayload(data);
      title = content.title;
      body = content.body;
      pushBody = content.pushBody;
      break;
    }
    case 'prescription_alert': {
      const content = buildPrescriptionAlertPayload(data);
      title = content.title;
      body = content.body;
      pushBody = content.pushBody;
      break;
    }
    case 'dlq_digest': {
      const content = buildDlqDigestPayload(data);
      title = content.title;
      body = content.body;
      pushBody = content.pushBody;
      break;
    }
    default:
      throw new Error(`Unknown notification kind: ${kind}`);
  }

  // 2. Resolver Deeplink lógico (Responsabilidade da Layer 2)
  const deeplink = resolveDeeplink(validatedKind, data);

  // 3. Aplicar Decoração de Reenvio (Gate 1 — Shim removido, agora via context)
  const decorated = applyRetryDecoration({ title, body, pushBody }, context);

  // Validação do Contrato de Saída (Gate L2 -> L3)
  return notificationPayloadSchema.parse({
    ...decorated,
    deeplink,
    actions,
    metadata
  });
}

/**
 * Auxiliar para formatar a descrição clínica do medicamento com quantidade e dosagem.
 * Exemplo: "Xarope (10ml) - 1 un." ou "Dipirona (500mg) - 2 un."
 */
const formatMedicineDescription = (name, qty, dosagePerPill, unit) => {
  let desc = name;
  if (dosagePerPill !== undefined && dosagePerPill !== null && unit) {
    desc += ` (${dosagePerPill}${unit})`;
  }
  if (qty !== undefined && qty !== null) {
    const formattedQty = String(qty).replace('.', ',');
    desc += ` - ${formattedQty} un.`;
  }
  return desc;
};

/**
 * Formata payload de lembrete de dose única.
 */
function formatDoseReminder(data, metadata) {
  const result = doseReminderDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid data for dose_reminder: ${result.error.message}`);
  }

  const { medicineName, time, dosage, hour, protocolId, critical_alarm, dosagePerIntake, dosageUnit, dosagePerPill } = result.data;
  const emoji = getTimeOfDayEmoji(hour);
  const greeting = getTimeOfDayGreeting(hour);
  const title = `${emoji} ${greeting}`;

  const safeTime = escapeMarkdownV2(time);
  let body, pushBody;
  const isCritical = critical_alarm === true;

  if (dosagePerIntake !== undefined) {
    const desc = formatMedicineDescription(medicineName, dosagePerIntake, dosagePerPill, dosageUnit);
    const safeDesc = escapeMarkdownV2(desc);
    if (isCritical) {
      body = `💊 *Medicamento essencial*: hora do seu *${safeDesc}* \\(${safeTime}\\)\\.`;
      pushBody = `💊 Medicamento essencial: hora do seu ${desc} (${time}).`;
    } else {
      body = `Está na hora de tomar *${safeDesc}* \\(${safeTime}\\)\\.`;
      pushBody = `Está na hora de tomar ${desc} (${time}).`;
    }
  } else {
    const safeName = escapeMarkdownV2(medicineName);
    if (isCritical) {
      if (dosage) {
        const safeDosage = escapeMarkdownV2(dosage);
        body = `💊 *Medicamento essencial*: hora do seu *${safeName}* \\(${safeTime}\\) — **${safeDosage}**\\.`;
        pushBody = `💊 Medicamento essencial: hora do seu ${medicineName} (${time}) — ${dosage}.`;
      } else {
        body = `💊 *Medicamento essencial*: hora do seu *${safeName}* \\(${safeTime}\\)\\.`;
        pushBody = `💊 Medicamento essencial: hora do seu ${medicineName} (${time}).`;
      }
    } else {
      if (dosage) {
        const safeDosage = escapeMarkdownV2(dosage);
        body = `Está na hora de tomar *${safeName}* \\(${safeTime}\\) — **${safeDosage}**\\.`;
        pushBody = `Está na hora de tomar ${medicineName} (${time}) — ${dosage}.`;
      } else {
        body = `Está na hora de tomar *${safeName}* \\(${safeTime}\\)\\.`;
        pushBody = `Está na hora de tomar ${medicineName} (${time}).`;
      }
    }
  }

  const actions = [
    { id: 'take', label: '✅ Tomar', params: { protocolId: protocolId ?? '', dosage: dosagePerIntake ?? 1 } },
    { id: 'skip', label: '⏭️ Pular', params: { protocolId: protocolId ?? '' } }
  ];

  return { title, body, pushBody, actions, metadata };
}

/**
 * Formata payload de lembrete de doses por plano.
 */
function formatDoseReminderByPlan(data, metadata) {
  const result = doseReminderByPlanDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid data for dose_reminder_by_plan: ${result.error.message}`);
  }

  const { planName, planId, scheduledTime, hour, doses, critical_alarm } = result.data;
  const emoji = getTimeOfDayEmoji(hour);
  const greeting = getTimeOfDayGreeting(hour);
  const title = `${emoji} ${greeting}`;
  const safePlanName = escapeMarkdownV2(planName || 'Plano de tratamento');
  const safeTime = escapeMarkdownV2(scheduledTime);
  const count = doses.length;
  const MAX_SHOWN = 10;
  const shown = doses.slice(0, MAX_SHOWN);
  const extra = count - shown.length;
  const isCritical = critical_alarm === true;

  const doseLines = shown.map(d => {
    const desc = formatMedicineDescription(d.medicineName, d.dosagePerIntake, d.dosagePerPill, d.dosageUnit);
    const safeDesc = escapeMarkdownV2(desc);
    return `  💊 ${safeDesc}`;
  }).join('\n');

  const plainLines = shown.map(d => {
    const desc = formatMedicineDescription(d.medicineName, d.dosagePerIntake, d.dosagePerPill, d.dosageUnit);
    return `• ${desc}`;
  }).join('\n');

  let body, pushBody;
  if (isCritical) {
    body = `📋 *Uso essencial*: hora dos medicamentos do plano *${safePlanName}* \\(${safeTime}\\)\\.\n\n${doseLines}`;
    pushBody = `📋 Uso essencial: hora dos medicamentos do plano ${planName} (${scheduledTime}).\n${plainLines}`;
  } else {
    body = `*${safePlanName}*\n\n${escapeMarkdownV2(String(count))} medicamentos agora — ${safeTime}\n\n${doseLines}`;
    pushBody = `Está na hora de tomar as doses do plano ${planName} (${scheduledTime}).\n${plainLines}`;
  }

  if (extra > 0) {
    body += `\n  _… e mais ${escapeMarkdownV2(String(extra))}_`;
    pushBody += `\n… e mais ${extra}`;
  }

  const planIdShort = String(planId ?? '').slice(0, 8);
  const actions = [
    { id: 'take_plan', label: '✅ Registrar este plano', params: { planIdShort, hhmm: scheduledTime } }
  ];

  return { title, body, pushBody, actions, metadata };
}

/**
 * Formata payload de lembrete de doses avulsas (misc).
 */
function formatDoseReminderMisc(data, metadata) {
  const result = doseReminderMiscDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid data for dose_reminder_misc: ${result.error.message}`);
  }

  const { scheduledTime, hour, doses, critical_alarm } = result.data;
  const emoji = getTimeOfDayEmoji(hour);
  const greeting = getTimeOfDayGreeting(hour);
  const title = `${emoji} ${greeting}`;
  const safeTime = escapeMarkdownV2(scheduledTime);
  const count = doses.length;
  const MAX_SHOWN = 10;
  const shown = doses.slice(0, MAX_SHOWN);
  const extra = count - shown.length;
  const isCritical = critical_alarm === true;

  const doseLines = shown.map(d => {
    const desc = formatMedicineDescription(d.medicineName, d.dosagePerIntake, d.dosagePerPill, d.dosageUnit);
    const safeDesc = escapeMarkdownV2(desc);
    return `  • ${safeDesc}`;
  }).join('\n');

  const plainLines = shown.map(d => {
    const desc = formatMedicineDescription(d.medicineName, d.dosagePerIntake, d.dosagePerPill, d.dosageUnit);
    return `• ${desc}`;
  }).join('\n');

  let body, pushBody;
  if (isCritical) {
    body = `💊 *Doses essenciais* pendentes para as *${safeTime}*\\.\n\n${doseLines}`;
    pushBody = `💊 Doses essenciais pendentes para as ${scheduledTime}:\n${plainLines}`;
  } else {
    body = `*Suas doses agora* — ${safeTime}\n\n${escapeMarkdownV2(String(count))} medicamento${count !== 1 ? 's' : ''} pendente${count !== 1 ? 's' : ''}:\n\n${doseLines}`;
    pushBody = `${count} medicamento${count !== 1 ? 's' : ''} pendente${count !== 1 ? 's' : ''} (${scheduledTime}):\n${plainLines}`;
  }

  if (extra > 0) {
    body += `\n  _… e mais ${escapeMarkdownV2(String(extra))}_`;
    pushBody += `\n… e mais ${extra}`;
  }

  const hhmm = scheduledTime;
  const actions = [
    { id: 'take_misc', label: '✅ Registrar todos', params: { hhmm } }
  ];

  return { title, body, pushBody, actions, metadata };
}

/**
 * Aplica decoração visual de reenvio se necessário.
 * Isolado para reduzir complexidade da função principal.
 */
function applyRetryDecoration(content, context) {
  const isRetry = context.isRetry ?? false;
  if (!isRetry) return content;

  return {
    ...content,
    title: `🔄 ${content.title} (Reenvio)`,
    body: `${content.body}\n\n_Esta é uma nova tentativa de envio\\._`,
    pushBody: `${content.pushBody}\n\n(Reenvio)`
  };
}

function getNavigationMetadata(kind, data, protocolIds) {
  const at = data.scheduledTime || data.time || 'now'

  const routes = {
    dose_reminder: { screen: 'dose-individual', params: { protocolId: data.protocolId, at } },
    dose_reminder_by_plan: { screen: 'bulk-plan', params: { planId: data.planId, treatmentPlanName: data.planName, at } },
    dose_reminder_misc: { screen: 'bulk-misc', params: { protocolIds, at } },
    stock_alert: { screen: 'stock', params: {} },
    prescription_alert: { screen: 'stock', params: {} },
    adherence_report: { screen: 'history', params: {} },
    weekly_adherence: { screen: 'history', params: {} },
    monthly_report: { screen: 'history', params: {} },
    daily_digest: { screen: 'history', params: {} },
    dlq_digest: { screen: 'admin/dlq', params: {} },
  }

  return routes[kind] || { screen: 'today', params: {} }
}

/**
 * Constrói objeto de metadados conforme whitelist estrita de `metadataSchema`.
 * Nenhum campo além dos definidos no schema é permitido (Gate 6).
 */
function buildMetadata(kind, context, data = {}) {
  // Extrair protocolIds se for um array ou se estiver em data.doses (para grouped/misc)
  let protocolIds = data.protocolIds || []
  if (protocolIds.length === 0 && Array.isArray(data.doses)) {
    protocolIds = data.doses.map(d => d.protocolId).filter(Boolean)
  }

  const navigation = getNavigationMetadata(kind, data, protocolIds)

  const rawMetadata = {
    kind,
    builtAt: getServerTimestamp(),
    navigation, // Objeto esperado pelo usePushNotifications do Mobile
    correlationId: context.correlationId,
    details: context.details,
    // Campos de negócio para persistência (Inbox/Logs)
    protocolId: data.protocolId,
    protocolIds: protocolIds.length > 0 ? protocolIds : undefined,
    medicineName: data.medicineName,
    planId: data.planId,
    planName: data.planName,
    percentage: data.percentage,
    nudge: data.nudge,
    critical_alarm: data.critical_alarm,
  }

  // Remove chaves com valor undefined
  return Object.fromEntries(Object.entries(rawMetadata).filter((entry) => entry[1] !== undefined))
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
    weekly_adherence: 'history',
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

    case 'dose_reminder_misc': {
      const pids = data.protocolIds?.join(',') || '';
      return `${BASE_URL}today?bulkMode=misc&at=${data.scheduledTime || 'now'}${pids ? `&protocolIds=${pids}` : ''}`;
    }

    default:
      return `${BASE_URL}today`;
  }
}
