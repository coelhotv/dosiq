import { z } from 'zod';

export const dailyDigestDataSchema = z.object({
  firstName: z.string(),
  hour: z.number().min(0).max(23),
  pendingCount: z.number(),
  medicines: z.array(z.object({
    name: z.string(),
    time: z.string(),
    dosagePerIntake: z.number().optional(),
    dosageUnit: z.string().optional()
  }))
});

export const adherenceReportDataSchema = z.object({
  firstName: z.string(),
  period: z.string(), // ex: "hoje", "esta semana"
  percentage: z.number().min(0).max(100),
  taken: z.number(),
  total: z.number(),
  comparison: z.object({
    previousPercentage: z.number().min(0).max(100),
    deltaPercent: z.number(),
    trend: z.enum(['up', 'down', 'flat'])
  }).optional()
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

// Schemas para ações interativas (Gate 4 preliminar)
export const actionSchema = z.object({
  id: z.enum(['take', 'snooze', 'skip', 'take_plan', 'take_misc', 'details']),
  label: z.string(),
  params: z.record(z.string(), z.unknown()).optional()
});

// Metadados estritos (Gate 1 / Gate 6) — whitelist explícita, sem passthrough.
// Todos os campos que buildMetadata() pode produzir devem estar listados aqui.
export const metadataSchema = z.object({
  kind: kindSchema,
  builtAt: z.string(),
  correlationId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  // Navegação mobile (usePushNotifications deep-linking N1.4)
  navigation: z.object({
    screen: z.string(),
    params: z.record(z.string(), z.unknown()).default({})
  }).optional(),
  // Campos de negócio para Inbox/Logs — somente os que existem no schema de dados
  protocolId: z.string().optional(),
  protocolIds: z.array(z.string()).optional(),
  medicineName: z.string().optional(),
  planId: z.string().optional(),
  planName: z.string().optional(),
  percentage: z.number().optional(),
  nudge: z.string().optional(),
});


// Novas validações de dados (Gate 1)
export const doseReminderDataSchema = z.object({
  medicineName: z.string(),
  time: z.string(),
  dosage: z.string().optional(), // Pre-formatted dosage string
  dosagePerIntake: z.number().optional(),
  dosageUnit: z.string().optional(),
  protocolId: z.string().optional(),
  hour: z.number().min(0).max(23).optional()
});

export const doseReminderByPlanDataSchema = z.object({
  planName: z.string(),
  planId: z.string().optional(),
  scheduledTime: z.string(),
  hour: z.number().min(0).max(23),
  doses: z.array(z.object({
    medicineName: z.string(),
    dosagePerIntake: z.number().max(100),
    dosageUnit: z.string().optional(),
    protocolId: z.string().optional()
  }))
});

export const doseReminderMiscDataSchema = z.object({
  scheduledTime: z.string(),
  hour: z.number().min(0).max(23),
  doses: z.array(z.object({
    medicineName: z.string(),
    dosagePerIntake: z.number().max(100),
    dosageUnit: z.string().optional(),
    protocolId: z.string().optional()
  })),
  protocolIds: z.array(z.string()).optional()
});

// Contrato de saída da Presentation Layer (L2) para a Delivery Layer (L3)
export const notificationPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  pushBody: z.string(), // Texto puro sem escapes para Push/Alerts (R-205)
  deeplink: z.string().startsWith('dosiq://').nullable(), // Garante padrão de deep linking do app
  actions: z.array(actionSchema).default([]),
  metadata: metadataSchema
});
