import { z } from 'zod'

/**
 * Schema de validação para análise de custos.
 *
 * Define a estrutura esperada de medicamentos e protocolos
 * que são entrada para o serviço de análise de custos.
 */

// Schema para entrada de estoque
export const StockEntrySchema = z.object({
  quantity: z.number().nonnegative('quantity deve ser >= 0'),
  unit_price: z.number().nonnegative('unit_price deve ser >= 0'),
  // Campos adicionais opcionais (não validamos todos, apenas os críticos)
})

// Schema para medicamento com estoque embarcado
export const MedicineWithStockSchema = z.object({
  id: z.string().min(1, 'id é obrigatório'),
  name: z.string().min(1, 'name é obrigatório'),
  stock: z
    .array(StockEntrySchema)
    .optional()
    .default([])
    .describe('Array de entradas de estoque'),
})

// Schema para protocolo
export const ProtocolSchema = z.object({
  medicine_id: z.string().min(1, 'medicine_id é obrigatório'),
  active: z.boolean().optional().default(true),
  dosage_per_intake: z
    .number()
    .nonnegative('dosage_per_intake deve ser >= 0')
    .optional()
    .default(0),
  time_schedule: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Array de horários (ex: ["08:00", "20:00"])'),
})

// Schema para entrada de calculateMonthlyCosts
export const CalculateMonthlyCostsInputSchema = z.object({
  medicines: z
    .array(MedicineWithStockSchema)
    .min(0, 'medicines deve ser um array')
    .optional()
    .default([]),
  protocols: z
    .array(ProtocolSchema)
    .min(0, 'protocols deve ser um array')
    .optional()
    .default([]),
})

// Schema para entrada de calculateDailyIntake
export const CalculateDailyIntakeInputSchema = z.object({
  medicineId: z.string().min(1, 'medicineId é obrigatório'),
  protocols: z
    .array(ProtocolSchema)
    .optional()
    .default([]),
})

// Schema para entrada de calculateAvgUnitPrice
export const CalculateAvgUnitPriceInputSchema = z.object({
  stockEntries: z
    .array(StockEntrySchema)
    .optional()
    .default([]),
})
