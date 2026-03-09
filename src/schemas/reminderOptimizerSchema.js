import { z } from 'zod'

/**
 * Schema para validação de entrada de analyzeReminderTiming.
 * Valida protocolo e logs para análise de delta de horários de tomada.
 */
export const AnalyzeReminderTimingInputSchema = z.object({
  protocol: z.object({
    id: z.string(),
    medicine_id: z.string(),
    frequency: z.string(),
    time_schedule: z.array(z.string()).nullable().optional(),
  }),
  logs: z.array(
    z.object({
      id: z.string(),
      protocol_id: z.string().nullable().optional(),
      medicine_id: z.string(),
      quantity_taken: z.number().positive().max(100).nullable().optional(),
      taken_at: z.string().datetime(), // ISO timestamp
    })
  ),
})

/**
 * Schema para resultado de analyzeReminderTiming.
 */
export const ReminderSuggestionSchema = z.object({
  shouldSuggest: z.boolean(),
  currentTime: z.string(), // HH:MM
  suggestedTime: z.string(), // HH:MM
  avgDeltaMinutes: z.number(),
  sampleCount: z.number(),
  direction: z.enum(['later', 'earlier']),
}).nullable()
