// titrationSchema.ts — Domínio da Evolução do tratamento (titulação N2, spec 029 / ADR-080, T002).
//
// Fonte canônica ÚNICA do vocabulário da escada (status da etapa, unidade de tomada) e do shape
// validado de `titrations` / `titration_steps`. Web e mobile citam daqui — enum divergente do
// CHECK do banco é a família AP-115/R-271: valor rejeitado em silêncio no `safeParse` ou no INSERT.
//
// ESCOPO F1: só o modelo. Motor de avanço, RPC de confirmação e migração N1→N2 são F2/F3 —
// este arquivo NÃO conhece transição nem `dose_change`/`medicine_switch` (tipo é derivado, ADR-080).

import { z } from 'zod'
import { INTAKE_UNITS } from './protocolSchema'

/**
 * Unidades de tomada de uma etapa. Espelha o CHECK de `titration_steps.intake_unit`.
 *
 * = `INTAKE_UNITS` do core (`gotas`/`ml`/`UI`/`mg`) + `cp` (comprimido). Derivado da constante
 * canônica de propósito (R-271/R-270): se alguém acrescentar uma unidade em `protocolSchema`, ela
 * entra aqui automaticamente — resta só espelhar no CHECK do banco. O teste de sync guarda a igualdade.
 */
export const TITRATION_INTAKE_UNITS = [...INTAKE_UNITS, 'cp'] as const

/** Estados de uma etapa da escada. Espelha o CHECK de `titration_steps.status`. */
export const TITRATION_STEP_STATUSES = [
  'upcoming', // ainda não começou
  'current', // etapa vigente
  'pending_confirmation', // medicine_switch aguardando confirmação do usuário (F3)
  'completed', // etapa encerrada
] as const

export type TitrationIntakeUnit = (typeof TITRATION_INTAKE_UNITS)[number]
export type TitrationStepStatus = (typeof TITRATION_STEP_STATUSES)[number]

/**
 * Linha de `titrations` como o banco a entrega (escada / orquestrador).
 *
 * `treatment_plan_id` e `migrated_from_protocol_id` são `.nullable().optional()` (R-085): a FK é
 * `ON DELETE SET NULL`, então o banco PODE devolver `null`, e o cliente PODE omiti-los na criação.
 */
export const titrationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  treatment_plan_id: z.string().uuid().nullable().optional(),
  migrated_from_protocol_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Titration = z.infer<typeof titrationSchema>

/**
 * Linha de `titration_steps` como o banco a entrega.
 *
 * `duration_days` NULL = etapa contínua (dose de manutenção sem fim previsto) — não é ausência de
 * dado. `protocol_id` NULL até a etapa entrar em curso (F3). `dose` positiva (espelha CHECK dose > 0).
 */
export const titrationStepSchema = z.object({
  id: z.string().uuid(),
  titration_id: z.string().uuid(),
  user_id: z.string().uuid(),
  position: z.number().int().min(0),
  medicine_id: z.string().uuid(),
  dose: z.number().positive(),
  intake_unit: z.enum(TITRATION_INTAKE_UNITS),
  duration_days: z.number().int().positive().nullable().optional(),
  status: z.enum(TITRATION_STEP_STATUSES),
  protocol_id: z.string().uuid().nullable().optional(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type TitrationStep = z.infer<typeof titrationStepSchema>

/**
 * Entrada de criação de uma etapa (builder do cadastro, F4). Só o que o usuário fornece:
 * a escada, o medicamento, a dose, a unidade, a posição e a duração. `status`/`protocol_id`/
 * timestamps são do servidor. `user_id` é derivado do dono no serviço, nunca aceito do cliente.
 */
export const titrationStepCreateSchema = z.object({
  titration_id: z.string().uuid(),
  position: z.number().int().min(0),
  medicine_id: z.string().uuid(),
  dose: z.number().positive(),
  intake_unit: z.enum(TITRATION_INTAKE_UNITS),
  duration_days: z.number().int().positive().nullable().optional(),
})

export type TitrationStepCreate = z.infer<typeof titrationStepCreateSchema>

/** Entrada de criação de uma escada. `user_id` é derivado no serviço (nunca do cliente). */
export const titrationCreateSchema = z.object({
  treatment_plan_id: z.string().uuid().nullable().optional(),
  migrated_from_protocol_id: z.string().uuid().nullable().optional(),
})

export type TitrationCreate = z.infer<typeof titrationCreateSchema>

/**
 * Valida uma linha de `titration_steps`. Retorna união discriminada estreitada por `success`.
 *
 * ⚠️ Consumers non-strict discriminam por `=== false`, nunca `!result.success` (R-286): num
 * programa `strict:false`, `!x` não estreita o tipo do ramo de erro.
 */
export function validateTitrationStep(
  data: unknown,
): { success: true; data: TitrationStep } | { success: false; error: z.ZodError } {
  const result = titrationStepSchema.safeParse(data)
  if (result.success === false) {
    return { success: false, error: result.error }
  }
  return { success: true, data: result.data }
}

export default titrationSchema
