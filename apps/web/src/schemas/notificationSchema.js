import { z } from 'zod'

/**
 * Constantes de tipos de notificação suportados pelo Dosiq.
 * Centralizado para evitar typos e facilitar manutenibilidade (Wave N2).
 */
export const NOTIFICATION_TYPES = {
  DOSE_REMINDER: 'dose_reminder',
  DOSE_REMINDER_BY_PLAN: 'dose_reminder_by_plan',
  DOSE_REMINDER_MISC: 'dose_reminder_misc',
  STOCK_ALERT: 'stock_alert',
  MISSED_DOSE: 'missed_dose',
  TITRATION_UPDATE: 'titration_update',
  DAILY_DIGEST: 'daily_digest',
}

/**
 * Lista de tipos relacionados a doses para lógica de 'wasTaken'.
 */
export const DOSE_RELATED_NOTIFICATION_TYPES = [
  NOTIFICATION_TYPES.DOSE_REMINDER,
  NOTIFICATION_TYPES.DOSE_REMINDER_BY_PLAN,
  NOTIFICATION_TYPES.DOSE_REMINDER_MISC,
]

/**
 * Schema para validação de uma notificação individual.
 */
export const notificationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  notification_type: z.nativeEnum(NOTIFICATION_TYPES),
  sent_at: z.string(), // ISO String
  status: z.string().optional(),
  body: z.string().nullable().optional(),
  
  // Metadados contextuais
  protocol_id: z.string().uuid().nullable().optional(),
  treatment_plan_id: z.string().uuid().nullable().optional(),
  medicine_name: z.string().nullable().optional(),
  protocol_name: z.string().nullable().optional(),
  treatment_plan_name: z.string().nullable().optional(),
  
  // Doses agrupadas (para daily_digest ou misc)
  doses: z.array(z.object({
    medicineName: z.string(),
    dosage: z.string(),
  })).nullable().optional(),
})

/**
 * Schema para uma lista de notificações.
 */
export const notificationListSchema = z.array(notificationSchema)
