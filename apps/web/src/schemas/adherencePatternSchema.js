import { z } from 'zod'

/**
 * Schema de validação para análise de padrões de adesão
 * Baseado na entrada de analyzeAdherencePatterns()
 */

// Estrutura de um log de dose
const logSchema = z.object({
  id: z.string().uuid(),
  medicine_id: z.string().uuid(),
  protocol_id: z.string().uuid().nullable().optional(),
  quantity_taken: z.number().positive().max(100),
  taken_at: z.string().datetime({ offset: true }),
})

// Estrutura de um protocolo
const protocolWithTimeScheduleSchema = z.object({
  id: z.string().uuid(),
  medicine_id: z.string().uuid(),
  name: z.string(),
  frequency: z.enum(['diário', 'dias_alternados', 'semanal', 'quando_necessário', 'personalizado']),
  time_schedule: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)),
  dosage_per_intake: z.number().positive(),
})

/**
 * Schema para entrada de analyzeAdherencePatterns
 */
export const AnalyzeAdherencePatternsInputSchema = z.object({
  logs: z.array(logSchema).describe('Logs de doses do usuário (mínimo 21 dias recomendado)'),
  protocols: z
    .array(protocolWithTimeScheduleSchema)
    .describe('Protocolos ativos com time_schedule'),
})

/**
 * Schema para célula do grid 7x4
 */
const gridCellSchema = z.object({
  taken: z.number().int().min(0),
  expected: z.number().int().min(0),
  adherence: z.number().min(0).max(100).nullable(),
})

/**
 * Schema para pior célula (worst cell)
 */
const worstCellSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  periodIndex: z.number().int().min(0).max(3),
  adherence: z.number().min(0).max(100),
  dayName: z.string(),
  periodName: z.string(),
})

/**
 * Schema para resultado de analyzeAdherencePatterns
 */
export const AnalyzeAdherencePatternsOutputSchema = z.object({
  grid: z.array(z.array(gridCellSchema)).describe('Grid 7x4 de adherência'),
  worstCell: worstCellSchema
    .nullable()
    .describe('Célula com pior adherência (null se dados insuficientes)'),
  narrative: z.string().describe('Narrativa em português sobre o pior horário'),
  hasEnoughData: z.boolean().describe('true se >= 21 dias de dados'),
})

/**
 * Valida entrada de analyzeAdherencePatterns
 * @param {Object} data - Dados de entrada
 * @returns {{ success: boolean, data?: Object, errors?: Array }}
 */
export function validateAnalyzeAdherencePatternsInput(data) {
  const result = AnalyzeAdherencePatternsInputSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

/**
 * Valida saída de analyzeAdherencePatterns
 * @param {Object} data - Dados de saída
 * @returns {{ success: boolean, data?: Object, errors?: Array }}
 */
export function validateAnalyzeAdherencePatternsOutput(data) {
  const result = AnalyzeAdherencePatternsOutputSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

export default AnalyzeAdherencePatternsInputSchema
