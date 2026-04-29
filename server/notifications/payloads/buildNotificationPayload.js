// Constrói payload canônico de notificação a partir de evento de domínio
// Todos os canais (Telegram, Expo) consomem este shape normalizado

import { z } from 'zod'

export const kindSchema = z.enum([
  'dose_reminder',
  'dose_reminder_by_plan',
  'dose_reminder_misc',
  'stock_alert',
  'daily_digest',
  'adherence_report',
])

export function buildNotificationPayload({ kind, data }) {
  const parsed = kindSchema.safeParse(kind)
  if (!parsed.success) {
    throw new Error(
      `[buildNotificationPayload] Unsupported notification kind: "${kind}". Supported: ${kindSchema.options.join(', ')}`
    )
  }

  switch (kind) {
    case 'dose_reminder':
      return {
        title: '💊 Lembrete de nova dose',
        body: `Está na hora de tomar ${data.dosage || 1}x de ${data.medicineName}. Não deixe para depois!`,
        deeplink: `dosiq://today?protocolId=${data.protocolId}`,
        metadata: { protocolId: data.protocolId, medicineId: data.medicineId, dosage: data.dosage || 1 },
      }

    case 'dose_reminder_by_plan': {
      const n = data.doses?.length ?? 0
      const planName = data.planName ?? 'Plano de tratamento'
      const scheduledTime = data.scheduledTime ?? 'agora'
      return {
        title: `💊 ${planName}`,
        body: `${n} medicamento${n !== 1 ? 's' : ''} — ${scheduledTime}`,
        deeplink: `dosiq://today?bulkMode=plan&planId=${data.planId}&at=${data.scheduledTime}`,
        metadata: {
          kind: 'dose_reminder_by_plan',
          planId: data.planId,
          planName: data.planName,
          doses: data.doses,
          scheduledTime: data.scheduledTime,
          hour: data.hour,
          protocolIds: data.protocolIds,
        },
      }
    }

    case 'dose_reminder_misc': {
      const n = data.doses?.length ?? 0
      const scheduledTime = data.scheduledTime ?? 'agora'
      return {
        title: '💊 Hora dos medicamentos',
        body: `${n} medicamento${n !== 1 ? 's' : ''} — ${scheduledTime}`,
        deeplink: `dosiq://today?bulkMode=misc&at=${data.scheduledTime}`,
        metadata: {
          kind: 'dose_reminder_misc',
          doses: data.doses,
          scheduledTime: data.scheduledTime,
          hour: data.hour,
          protocolIds: data.protocolIds,
        },
      }
    }

    case 'stock_alert':
      return {
        title: 'Estoque baixo',
        body: `${data.medicineName} está acabando`,
        deeplink: `dosiq://stock`,
        metadata: { medicineId: data.medicineId },
      }

    case 'daily_digest':
      return {
        title: 'Resumo do dia',
        body: data.summary,
        deeplink: `dosiq://today`,
        metadata: {},
      }
    case 'adherence_report':
      return {
        title: '📊 Relatório de Adesão',
        body: data.summary,
        deeplink: `dosiq://today`,
        metadata: {},
      }
  }
}
