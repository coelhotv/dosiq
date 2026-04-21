// Constrói payload canônico de notificação a partir de evento de domínio
// Todos os canais (Telegram, Expo) consomem este shape normalizado

import { z } from 'zod'

const kindSchema = z.enum(['dose_reminder', 'stock_alert', 'daily_digest'])

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
  }
}
