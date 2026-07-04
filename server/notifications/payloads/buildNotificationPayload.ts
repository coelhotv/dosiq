// Constrói payload canônico de notificação a partir de evento de domínio
// Todos os canais (Telegram, Expo) consomem este shape normalizado

import type { z } from 'zod';

import {
  getServerTimestamp,
  getSaoPauloTime
} from '../../utils/dateUtils.js';

import { escapeMarkdownV2 } from '../../utils/formatters.js';

import { DOSAGE_UNIT_LABELS } from '@dosiq/core';

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
} from './_payloadSchemas';

export { kindSchema, notificationPayloadSchema, actionSchema, metadataSchema };

import {
  buildDailyDigestPayload,
  buildAdherenceReportPayload,
  buildWeeklyAdherencePayload,
  buildStockAlertPayload,
  buildStockExpiryAlertPayload,
  buildTitrationAlertPayload,
  buildMonthlyReportPayload,
  buildPrescriptionAlertPayload,
  buildDlqDigestPayload
} from './_payloadBuilders';

type Kind = z.infer<typeof kindSchema>;

interface NotificationPayloadContent {
  title: string;
  body: string;
  pushBody: string;
  actions?: Array<z.input<typeof actionSchema>>;
  metadata?: Metadata;
}

interface NotificationContext {
  correlationId?: string;
  details?: Record<string, unknown>;
  isRetry?: boolean;
}

// Shape amplo dos dados de evento de domínio — cada builder valida (via zod)
// só os campos que realmente usa; os demais campos aqui são acesso oportunista
// (deeplink/metadata) e por isso ficam opcionais.
interface NotificationEventData {
  scheduledTime?: string;
  time?: string;
  protocolId?: string;
  protocolIds?: string[];
  planId?: string;
  planName?: string;
  medicineName?: string;
  percentage?: number;
  nudge?: string;
  critical_alarm?: boolean;
  doses?: Array<{ protocolId?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

type Metadata = z.infer<typeof metadataSchema>;

/**
 * Centralizador de construção de payloads de notificação.
 * Garante que todas as mensagens sigam o mesmo padrão visual e de escape.
 */
const PAYLOAD_BUILDERS: Record<string, (data: NotificationEventData) => { title: string; body: string; pushBody: string }> = {
  daily_digest: (data) => buildDailyDigestPayload(data as never),
  adherence_report: (data) => buildAdherenceReportPayload(data as never),
  weekly_adherence: (data) => buildWeeklyAdherencePayload(data as never),
  stock_alert: (data) => buildStockAlertPayload(data as never),
  stock_expiry_alert: (data) => buildStockExpiryAlertPayload(data as never),
  titration_alert: (data) => buildTitrationAlertPayload(data as never),
  monthly_report: (data) => buildMonthlyReportPayload(data as never),
  prescription_alert: (data) => buildPrescriptionAlertPayload(data as never),
  dlq_digest: (data) => buildDlqDigestPayload(data as never),
};

// Auxiliar para direcionar a construção do payload conforme o kind.
function _buildPayloadContent(kind: Kind, data: NotificationEventData, metadata: Metadata): NotificationPayloadContent {
  if (kind === 'dose_reminder') {
    return formatDoseReminder(data, metadata);
  }
  if (kind === 'dose_reminder_by_plan') {
    return formatDoseReminderByPlan(data, metadata);
  }
  if (kind === 'dose_reminder_misc') {
    return formatDoseReminderMisc(data, metadata);
  }

  const builder = PAYLOAD_BUILDERS[kind];
  if (!builder) {
    throw new Error(`Unknown notification kind: ${kind}`);
  }
  return { ...builder(data), metadata };
}

export function buildNotificationPayload({ kind, data, context = {} }: { kind: string; data: NotificationEventData; context?: NotificationContext }) {
  // 1. Validar Kind
  const validatedKind = kindSchema.parse(kind);

  const metadata = buildMetadata(validatedKind, context, data);
  const content = _buildPayloadContent(validatedKind, data, metadata);

  const title = content.title;
  const body = content.body;
  const pushBody = content.pushBody;
  const actions = content.actions || [];

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
 * Exemplo: "Xarope (10ml) • 1 un." ou "Dipirona (500mg) • 2 un."
 */
const formatMedicineDescription = (
  name: string,
  qty: number | undefined | null,
  dosagePerPill: number | undefined | null,
  unit: string | undefined,
  intakeUnit: string | undefined | null
): string => {
  let desc = name;
  if (dosagePerPill !== undefined && dosagePerPill !== null && unit) {
    // 012 Fase D (FR-015b c): case canônico do acrônimo — 'ui/ml' → 'UI/ml',
    // 'ui' → 'UI' (DOSAGE_UNIT_LABELS); 'mg'/'ml' inalterados. Sem label → unit cru.
    const unitLabel = (DOSAGE_UNIT_LABELS as Record<string, string>)?.[unit] || unit;
    desc += ` (${dosagePerPill}${unitLabel})`;
  }
  if (qty !== undefined && qty !== null) {
    const formattedQty = String(qty).replace('.', ',');
    // Líquidos (022): unidade de tomada real (gotas/ml/UI) em vez do genérico "un.".
    desc += intakeUnit ? ` • ${formattedQty} ${intakeUnit}` : ` • ${formattedQty} un.`;
  }
  return desc;
};

/**
 * Formata payload de lembrete de dose única.
 */
function formatDoseReminder(data: NotificationEventData, metadata: Metadata): NotificationPayloadContent {
  const result = doseReminderDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid data for dose_reminder: ${result.error.message}`);
  }

  const { medicineName, time, dosage, hour, protocolId, critical_alarm, dosagePerIntake, dosageUnit, dosagePerPill, intakeUnit } = result.data;
  const isCritical = critical_alarm === true;
  const safeHour = hour ?? getSaoPauloTime().getHours();
  const emoji = getTimeOfDayEmoji(safeHour);
  const greeting = getTimeOfDayGreeting(safeHour);
  const title = isCritical ? '💊 Remédio essencial' : `${emoji} ${greeting}`;

  const safeTime = escapeMarkdownV2(time);
  let body, pushBody;

  if (isCritical) {
    if (dosagePerIntake !== undefined) {
      const desc = formatMedicineDescription(medicineName, dosagePerIntake, dosagePerPill, dosageUnit, intakeUnit);
      const safeDesc = escapeMarkdownV2(desc);
      body = `Hora de tomar *${safeDesc}* — ${safeTime}`;
      pushBody = `Hora de tomar ${desc} — ${time}`;
    } else {
      const safeName = escapeMarkdownV2(medicineName);
      if (dosage) {
        const safeDosage = escapeMarkdownV2(dosage);
        body = `Hora de tomar *${safeName}* • **${safeDosage}** — ${safeTime}`;
        pushBody = `Hora de tomar ${medicineName} • ${dosage} — ${time}`;
      } else {
        body = `Hora de tomar *${safeName}* — ${safeTime}`;
        pushBody = `Hora de tomar ${medicineName} — ${time}`;
      }
    }
  } else {
    if (dosagePerIntake !== undefined) {
      const desc = formatMedicineDescription(medicineName, dosagePerIntake, dosagePerPill, dosageUnit, intakeUnit);
      const safeDesc = escapeMarkdownV2(desc);
      body = `Está na hora de tomar *${safeDesc}* — ${safeTime}`;
      pushBody = `Está na hora de tomar ${desc} — ${time}`;
    } else {
      const resolvedDosage = dosage;
      const safeName = escapeMarkdownV2(medicineName);
      if (resolvedDosage) {
        const safeDosage = escapeMarkdownV2(resolvedDosage);
        body = `Está na hora de tomar *${safeName}* • **${safeDosage}** — ${safeTime}`;
        pushBody = `Está na hora de tomar ${medicineName} • ${resolvedDosage} — ${time}`;
      } else {
        body = `Está na hora de tomar *${safeName}* — ${safeTime}`;
        pushBody = `Está na hora de tomar ${medicineName} — ${time}`;
      }
    }
  }

  const actions: Array<z.input<typeof actionSchema>> = [
    { id: 'take', label: '✅ Tomar', params: { protocolId: protocolId ?? '', dosage: dosagePerIntake ?? 1 } },
    { id: 'snooze', label: '⏰ Soneca', params: { protocolId: protocolId ?? '' } },
    { id: 'skip', label: '⏭️ Pular', params: { protocolId: protocolId ?? '' } }
  ];

  return { title, body, pushBody, actions, metadata };
}

/**
 * Formata payload de lembrete de doses por plano.
 */
function formatDoseReminderByPlan(data: NotificationEventData, metadata: Metadata): NotificationPayloadContent {
  const result = doseReminderByPlanDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid data for dose_reminder_by_plan: ${result.error.message}`);
  }

  const { planName, planId, scheduledTime, hour, doses, critical_alarm } = result.data;
  const isCritical = critical_alarm === true;
  const emoji = getTimeOfDayEmoji(hour);
  const greeting = getTimeOfDayGreeting(hour);
  const title = isCritical ? '📂 Plano essencial' : `${emoji} ${greeting}`;
  const safePlanName = escapeMarkdownV2(planName || 'Plano terapêutico');
  const safeTime = escapeMarkdownV2(scheduledTime);
  const count = doses.length;
  const MAX_SHOWN = 10;
  const shown = doses.slice(0, MAX_SHOWN);
  const extra = count - shown.length;

  let doseLines, plainLines;
  doseLines = shown.map(d => {
    const desc = formatMedicineDescription(d.medicineName, d.dosagePerIntake, d.dosagePerPill, d.dosageUnit, d.intakeUnit);
    const safeDesc = escapeMarkdownV2(desc);
    return `  – ${safeDesc}`;
  }).join('\n');

  plainLines = shown.map(d => {
    const desc = formatMedicineDescription(d.medicineName, d.dosagePerIntake, d.dosagePerPill, d.dosageUnit, d.intakeUnit);
    return `– ${desc}`;
  }).join('\n');

  let body, pushBody;
  if (isCritical) {
    body = `Hora dos remédios de *${safePlanName}* — ${safeTime}\\.\n\n${doseLines}`;
    pushBody = `Hora dos remédios de ${planName} — ${scheduledTime}.\n${plainLines}`;
  } else {
    body = `*${safePlanName}*\n\n${escapeMarkdownV2(String(count))} remédios agora — ${safeTime}\n\n${doseLines}`;
    pushBody = `Está na hora do plano ${planName} — ${scheduledTime}.\n${plainLines}`;
  }

  if (extra > 0) {
    body += `\n  _… e mais ${escapeMarkdownV2(String(extra))}_`;
    pushBody += `\n… e mais ${extra}`;
  }

  const planIdShort = String(planId ?? '').slice(0, 8);
  const actions: Array<z.input<typeof actionSchema>> = [
    { id: 'take_plan', label: '✅ Registrar este plano', params: { planIdShort, hhmm: scheduledTime } }
  ];

  return { title, body, pushBody, actions, metadata };
}

/**
 * Formata payload de lembrete de doses avulsas (misc).
 */
function formatDoseReminderMisc(data: NotificationEventData, metadata: Metadata): NotificationPayloadContent {
  const result = doseReminderMiscDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid data for dose_reminder_misc: ${result.error.message}`);
  }

  const { scheduledTime, hour, doses, critical_alarm } = result.data;
  const isCritical = critical_alarm === true;
  const emoji = getTimeOfDayEmoji(hour);
  const greeting = getTimeOfDayGreeting(hour);
  const title = isCritical ? '📋 Doses essenciais' : `${emoji} ${greeting}`;
  const safeTime = escapeMarkdownV2(scheduledTime);
  const count = doses.length;
  const MAX_SHOWN = 10;
  const shown = doses.slice(0, MAX_SHOWN);
  const extra = count - shown.length;

  let doseLines, plainLines;
  doseLines = shown.map(d => {
    const desc = formatMedicineDescription(d.medicineName, d.dosagePerIntake, d.dosagePerPill, d.dosageUnit, d.intakeUnit);
    const safeDesc = escapeMarkdownV2(desc);
    return `  – ${safeDesc}`;
  }).join('\n');

  plainLines = shown.map(d => {
    const desc = formatMedicineDescription(d.medicineName, d.dosagePerIntake, d.dosagePerPill, d.dosageUnit, d.intakeUnit);
    return `– ${desc}`;
  }).join('\n');

  let body, pushBody;
  if (isCritical) {
    body = `Remédios essenciais agora — *${safeTime}*\\.\n\n${doseLines}`;
    pushBody = `Remédios essenciais agora — ${scheduledTime}:\n${plainLines}`;
  } else {
    body = `*Suas doses agora* — ${safeTime}\n\n${escapeMarkdownV2(String(count))} remédio${count !== 1 ? 's' : ''} pendente${count !== 1 ? 's' : ''}:\n\n${doseLines}`;
    pushBody = `${count} remédio${count !== 1 ? 's' : ''} pendente${count !== 1 ? 's' : ''} — ${scheduledTime}:\n${plainLines}`;
  }

  if (extra > 0) {
    body += `\n  _… e mais ${escapeMarkdownV2(String(extra))}_`;
    pushBody += `\n… e mais ${extra}`;
  }

  const hhmm = scheduledTime;
  const actions: Array<z.input<typeof actionSchema>> = [
    { id: 'take_misc', label: '✅ Registrar todos', params: { hhmm } }
  ];

  return { title, body, pushBody, actions, metadata };
}

/**
 * Aplica decoração visual de reenvio se necessário.
 * Isolado para reduzir complexidade da função principal.
 */
function applyRetryDecoration(
  content: { title: string; body: string; pushBody: string },
  context: NotificationContext
): { title: string; body: string; pushBody: string } {
  const isRetry = context.isRetry ?? false;
  if (!isRetry) return content;

  return {
    ...content,
    title: `🔄 ${content.title} (Reenvio)`,
    body: `${content.body}\n\n_Esta é uma nova tentativa de envio\\._`,
    pushBody: `${content.pushBody}\n\n(Reenvio)`
  };
}

interface NavigationMetadata {
  screen: string;
  params: Record<string, unknown>;
}

function getNavigationMetadata(kind: Kind, data: NotificationEventData, protocolIds: string[]): NavigationMetadata {
  const at = data.scheduledTime || data.time || 'now'

  const routes: Record<string, NavigationMetadata> = {
    dose_reminder: { screen: 'dose-individual', params: { protocolId: data.protocolId, at } },
    dose_reminder_by_plan: { screen: 'bulk-plan', params: { planId: data.planId, treatmentPlanName: data.planName, at } },
    dose_reminder_misc: { screen: 'bulk-misc', params: { protocolIds, at } },
    stock_alert: { screen: 'stock', params: {} },
    stock_expiry_alert: { screen: 'stock', params: {} },
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
function buildMetadata(kind: Kind, context: NotificationContext, data: NotificationEventData = {}): Metadata {
  // Extrair protocolIds se for um array ou se estiver em data.doses (para grouped/misc)
  let protocolIds = data.protocolIds || []
  if (protocolIds.length === 0 && Array.isArray(data.doses)) {
    protocolIds = data.doses.map((d) => d.protocolId).filter((id): id is string => Boolean(id))
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
  return metadataSchema.parse(Object.fromEntries(Object.entries(rawMetadata).filter((entry) => entry[1] !== undefined)))
}

/**
 * Resolve o deeplink canônico para cada tipo de notificação.
 * Centraliza a lógica de rotas e parâmetros.
 */
function resolveDeeplink(kind: Kind, data: NotificationEventData): string {
  const BASE_URL = 'dosiq://';
  
  // 1. Mapeamento de rotas estáticas
  const staticRoutes: Record<string, string> = {
    adherence_report: 'history',
    weekly_adherence: 'history',
    monthly_report: 'history',
    stock_alert: 'stock',
    stock_expiry_alert: 'stock',
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
