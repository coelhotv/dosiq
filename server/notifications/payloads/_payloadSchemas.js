import { z } from 'zod';

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
