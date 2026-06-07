import { z } from 'zod'

/**
 * Schema de validação para Medicamentos
 * Baseado na tabela 'medicines' do Supabase
 */

// Unidades de CONCENTRAÇÃO válidas (alinhadas com MedicineForm.jsx dropdown).
// 'ml'/'gotas' saíram da lista (viram unidade de TOMADA em protocols.intake_unit — 022 Fase A).
// 'mg/ml'/'ui/ml' são razões massa/volume: líquido := dosage_unit LIKE '%/ml' (decisão-mãe).
// Ordem do dropdown: sólidos base → concentrações-ratio (/ml) → ui/un.
export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'mg/ml', 'ui/ml', 'ui', 'un']

// Labels de unidade para exibição (ordem espelha DOSAGE_UNITS)
export const DOSAGE_UNIT_LABELS = {
  mg: 'mg',
  mcg: 'mcg',
  g: 'g',
  'mg/ml': 'mg/ml',
  'ui/ml': 'UI/ml',
  ui: 'UI',
  un: 'un.',
}

// Tipos de medicamento
export const MEDICINE_TYPES = ['medicamento', 'suplemento']

// Labels de tipo para exibição
export const MEDICINE_TYPE_LABELS = {
  medicamento: 'Medicamento',
  suplemento: 'Suplemento',
}

// Forma farmacêutica (additiva — ADR-058; alinha MEDICINE_TYPES do produto).
// Sincronizada com CHECK medicines_presentation_check (R-082/R-271). Valores PT (R-021).
export const PRESENTATIONS = [
  'comprimido',
  'capsula',
  'liquido',
  'injecao',
  'pomada',
  'spray',
  'outro',
]

export const PRESENTATION_LABELS = {
  comprimido: 'Comprimido',
  capsula: 'Cápsula',
  liquido: 'Líquido',
  injecao: 'Injeção',
  pomada: 'Pomada',
  spray: 'Spray',
  outro: 'Outro',
}

export const REGULATORY_CATEGORIES = [
  'Genérico',
  'Similar',
  'Novo',
  'Biológico',
  'Específico',
  'Fitoterápico',
  'Dinamizado',
  'Outros',
]

export const REGULATORY_CATEGORY_LABELS = {
  Genérico: 'Genérico',
  Similar: 'Similar',
  Novo: 'Novo',
  Biológico: 'Biológico',
  Específico: 'Específico',
  Fitoterápico: 'Fitoterápico',
  Dinamizado: 'Dinamizado',
  Outros: 'Outros',
}

/**
 * Schema base para medicamento
 */
// Mensagens de erro friendly via z.config global (ver packages/core/src/zodSetup.js).
// Aqui mantemos apenas overrides específicos quando regra de negócio exige texto
// diferente do padrão (ex: "máx 200 caracteres" — informação útil, não jargão).

// Objeto base (ZodObject) — preserva .partial()/.extend(). O refine de líquido
// é aplicado SEPARADAMENTE em medicineSchema/medicineFullSchema (ZodEffects não
// expõe .partial()/.extend()).
const medicineObject = z.object({
  name: z
    .string()
    .min(2, 'O nome precisa de pelo menos 2 caracteres')
    .max(200, 'O nome pode ter no máximo 200 caracteres')
    .trim(),

  laboratory: z
    .string()
    .max(200, 'O laboratório pode ter no máximo 200 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  active_ingredient: z
    .string()
    .max(300, 'O princípio ativo pode ter no máximo 300 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  // Concentração (mg/cp p/ sólidos; mg ou UI por ml p/ líquidos). NULLABLE: líquidos
  // legados migrados (022 Fase A) têm dosage_per_pill NULL — massa ativa só exibida
  // quando o usuário preenche; decremento/adesão não dependem dela.
  dosage_per_pill: z.coerce
    .number()
    .positive('A dose deve ser maior que zero')
    .max(10000, 'A dose parece muito alta. Verifique o valor')
    .nullable()
    .optional(),

  dosage_unit: z.enum(DOSAGE_UNITS),

  // Razão→ml genérica (ADR-058): gotas/ml=20, UI/ml=100. Obrigatória p/ líquidos
  // (validada no superRefine). NUMERIC (aceita fração).
  units_per_ml: z.coerce
    .number()
    .positive('Densidade (unidades por ml) deve ser maior que zero')
    .nullable()
    .optional(),

  // Forma farmacêutica (additiva — ADR-058). Default 'comprimido' espelha o DEFAULT do DB.
  presentation: z.enum(PRESENTATIONS).default('comprimido'),

  type: z.enum(MEDICINE_TYPES).default('medicamento'),

  therapeutic_class: z
    .string()
    .max(100, 'A classe terapêutica pode ter no máximo 100 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  regulatory_category: z
    .enum(REGULATORY_CATEGORIES)
    .optional()
    .nullable()
    .transform((val) => val || null),
})

// Refine de líquido: unidade terminando em '/ml' exige units_per_ml (padrão 20 na UI).
const requireUnitsPerMlForLiquid = (data, ctx) => {
  if (data.dosage_unit?.endsWith('/ml') && data.units_per_ml == null) {
    ctx.addIssue({
      code: 'custom',
      path: ['units_per_ml'],
      message: 'Densidade (unidades por ml) é obrigatória para medicamentos líquidos (padrão 20).',
    })
  }
}

export const medicineSchema = medicineObject.superRefine(requireUnitsPerMlForLiquid)

/**
 * Schema para criação de medicamento (sem id)
 */
export const medicineCreateSchema = medicineSchema

/**
 * Schema para atualização de medicamento (campos opcionais).
 * Base no objeto (não no refined) — updates parciais não reavaliam o refine de líquido.
 */
export const medicineUpdateSchema = medicineObject.partial()

/**
 * Schema completo com ID (para validação de dados do backend)
 */
export const medicineFullSchema = medicineObject
  .extend({
    id: z.string().uuid('ID do medicamento deve ser um UUID válido'),
    user_id: z.string().uuid('ID do usuário deve ser um UUID válido'),
    created_at: z.string().datetime({ offset: true }).optional(),
    updated_at: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine(requireUnitsPerMlForLiquid)

/**
 * Valida um objeto de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicine(data) {
  const result = medicineSchema.safeParse(data)

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
 * Valida dados para criação de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicineCreate(data) {
  const result = medicineCreateSchema.safeParse(data)

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
 * Valida dados para atualização de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicineUpdate(data) {
  const result = medicineUpdateSchema.safeParse(data)

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
 * Converte erros do Zod para formato amigável para formulários
 * @param {Array} zodErrors - Array de erros do Zod
 * @returns {Object} Objeto com campo como chave e mensagem como valor
 */
export function mapMedicineErrorsToForm(zodErrors) {
  const formErrors = {}

  zodErrors.forEach((error) => {
    const field = error.path[0]
    if (!formErrors[field]) {
      formErrors[field] = error.message
    }
  })

  return formErrors
}

/**
 * Obtém mensagem de erro geral para exibição
 * @param {Array} errors - Array de erros
 * @returns {string} Mensagem formatada
 */
export function getMedicineErrorMessage(errors) {
  if (!errors || errors.length === 0) return ''

  if (errors.length === 1) {
    return errors[0].message
  }

  return `Existem ${errors.length} erros no formulário. Verifique os campos destacados.`
}

export default medicineSchema
