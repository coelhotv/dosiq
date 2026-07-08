// chatbotContextSchema.js — Seam Zod do contexto do chatbot (CON-028, spec 015 / ADR-074).
//
// Valida a SAÍDA do fetcher canônico (`fetchChatbotContextData`) == ENTRADA do builder
// (`buildPatientContext`). É o 3º mecanismo de paridade da FR-010: dado faltando/errado
// FALHA ALTO antes do builder, nunca gera contexto silenciosamente divergente entre as
// 3 superfícies (web / Telegram / mobile).
//
// As entidades são linhas cruas do Supabase (muitos campos opcionais por superfície);
// usamos `.passthrough()` para não enrijecer o shape — o seam garante PRESENÇA e TIPO
// das chaves de topo, não o formato interno de cada coluna.

import { z } from 'zod'

/** Linha crua tolerante — preserva colunas extras (passthrough). */
const looseRow = z.object({}).passthrough()

/** Resumo de estoque já derivado pelo fetcher (rich shape — paridade web). */
const stockSummaryEntrySchema = z
  .object({
    medicine: looseRow.nullable().optional(),
    total: z.number().nullable().optional(),
    daysRemaining: z.number().nullable().optional(),
    dailyIntake: z.number().nullable().optional(),
    isZero: z.boolean().nullable().optional(),
    isLow: z.boolean().nullable().optional(),
  })
  .passthrough()

/** Stats de adesão (instances-based; R-248). `adherence` 0-1 ou null. */
const statsSchema = z
  .object({
    adherence: z.number().min(0).max(1).nullable().optional(),
  })
  .passthrough()

export const chatbotContextDataSchema = z.object({
  medicines: z.array(looseRow).default([]),
  protocols: z.array(looseRow).default([]),
  logs: z.array(looseRow).default([]),
  stockSummary: z.array(stockSummaryEntrySchema).default([]),
  stats: statsSchema.nullable().default(null),
  doseInstances: z.array(looseRow).default([]),
  treatmentPlans: z.array(looseRow).default([]),
  // Perfil leve do paciente (nome/idade). Secundário — pode ser null. passthrough tolera
  // colunas extras de user_settings sem enrijecer o shape.
  profile: looseRow.nullable().default(null),
})

/**
 * Valida (e normaliza com defaults) o shape do contexto do chatbot.
 * @param data
 * @returns {success:true,data:object}|{success:false,errors:Array<{field:string,message:string}>}
 */
export type ChatbotContextData = z.infer<typeof chatbotContextDataSchema>

export type ValidateChatbotContextDataResult =
  | { success: true; data: ChatbotContextData }
  | { success: false; errors: Array<{ field: string; message: string }> }

export function validateChatbotContextData(data: unknown): ValidateChatbotContextDataResult {
  const result = chatbotContextDataSchema.safeParse(data)
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    }
  }
  return { success: true, data: result.data }
}
