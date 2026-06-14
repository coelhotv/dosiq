// packages/core/src/schemas/biomarkerLogSchema.js
// Schema de validação para biomarkers_log (012 Fase C · ADR-060)
//
// Modelo genérico: um shape serve glicemia/peso/pressão_arterial/batimentos e cresce sem migração.
// `type`/`source` extensíveis (ADR-060) — enum aqui é o guard v1 (DB não tem CHECK em type/source).
// `context` é enum fechado, sincronizado com o CHECK SQL (R-082/R-271).
// `value_secondary` = 2º componente de medida composta (PA: sistólica=value, diastólica=value_secondary;
// NULL p/ demais). superRefine cruza type↔value_secondary (decisão PO 2026-06-10).
// preprocess('' → null) nos numéricos: forms enviam '' ao limpar; sem isso z.coerce vira '' → 0 e
// .positive() bloqueia (mesma lição de medicineSchema/AP-214).

import { z } from 'zod'

// Tipos de biomarcador. v1 com UI = glicemia + peso (Planning 2026-06-14); pressao_arterial é
// schema-ready (regra existe, sem UI nesta fase); batimentos reservado. Extensível sem migração.
export const BIOMARKER_TYPES = ['glicemia', 'peso', 'pressao_arterial', 'batimentos']
export const BIOMARKER_TYPE_LABELS = {
  glicemia: 'Glicemia',
  peso: 'Peso',
  pressao_arterial: 'Pressão arterial',
  batimentos: 'Batimentos',
}

// Unidade fixa por tipo (a UI não deixa o usuário escolher unidade — FR-010).
export const BIOMARKER_TYPE_UNITS = {
  glicemia: 'mg/dL',
  peso: 'kg',
  pressao_arterial: 'mmHg',
  batimentos: 'bpm',
}

// Contexto da medida — enum fechado (sincronizado com CHECK SQL). Relevante p/ glicemia.
export const BIOMARKER_CONTEXTS = ['jejum', 'pre_refeicao', 'pos_refeicao', 'ao_deitar', 'outro']
export const BIOMARKER_CONTEXT_LABELS = {
  jejum: 'Jejum',
  pre_refeicao: 'Antes de comer',
  pos_refeicao: 'Depois de comer',
  ao_deitar: 'Ao deitar',
  outro: 'Outro',
}

// Origem do dado. v1 = manual; HealthSync futuro entra sem migração (ADR-060).
export const BIOMARKER_SOURCES = ['manual', 'healthkit', 'google_fit', 'health_connect']

const numericPositive = (msg) =>
  z.preprocess(
    (val) => (val === '' ? null : val),
    z.coerce.number({ invalid_type_error: msg }).positive(msg)
  )

// Objeto base (ZodObject) — preserva .partial()/.extend(). O refine de PA é aplicado SEPARADAMENTE
// em biomarkerLogSchema (ZodEffects não expõe .partial() — R-274).
const biomarkerObject = z.object({
  type: z.enum(BIOMARKER_TYPES).default('glicemia'),

  value: numericPositive('O valor deve ser um número maior que zero'),

  // 2º componente (PA diastólica). NULL p/ tipos de valor único.
  value_secondary: z.preprocess(
    (val) => (val === '' ? null : val),
    z.coerce.number().positive('O valor deve ser maior que zero').nullable().optional()
  ),

  // Unidade fixa por tipo (preenchida pela UI a partir de BIOMARKER_TYPE_UNITS).
  unit: z.string().min(1, 'A unidade é obrigatória').max(20).trim(),

  // Instante da medida (default "agora"; aceita retroativo). String ISO ou Date.
  measured_at: z
    .union([z.string().datetime({ offset: true }), z.date()])
    .optional(),

  context: z.enum(BIOMARKER_CONTEXTS).nullable().optional(),

  source: z.enum(BIOMARKER_SOURCES).default('manual'),

  notes: z
    .string()
    .max(500, 'A observação pode ter no máximo 500 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),
})

// Regra composta PA: pressao_arterial exige value_secondary; demais tipos não podem tê-lo.
// Schema-ready — a regra vive aqui mesmo sem UI de PA no v1.
const applyPaRefine = (schema) =>
  schema.superRefine((data, ctx) => {
    if (data.type === 'pressao_arterial') {
      if (data.value_secondary == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value_secondary'],
          message: 'Pressão arterial exige diastólica (value_secondary)',
        })
      }
    } else if (data.value_secondary != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value_secondary'],
        message: 'value_secondary só se aplica à pressão arterial',
      })
    }
  })

export const biomarkerLogSchema = applyPaRefine(biomarkerObject)
export const biomarkerLogCreateSchema = biomarkerLogSchema

// Update: base parcial SEM refine (R-274) + sem reaplicar default em campos com .default().
export const biomarkerLogUpdateSchema = biomarkerObject.partial().extend({
  type: z.enum(BIOMARKER_TYPES).optional(),
  source: z.enum(BIOMARKER_SOURCES).optional(),
})

export const biomarkerLogFullSchema = applyPaRefine(
  biomarkerObject.extend({
    id: z.string().uuid('ID deve ser um UUID válido'),
    user_id: z.string().uuid('ID do usuário deve ser um UUID válido'),
    created_at: z.string().datetime({ offset: true }).optional(),
  })
)

function toResult(result) {
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  }
}

/** Valida criação de biomarcador */
export function validateBiomarkerLog(data) {
  return toResult(biomarkerLogSchema.safeParse(data))
}

/** Valida atualização parcial de biomarcador */
export function validateBiomarkerLogUpdate(data) {
  return toResult(biomarkerLogUpdateSchema.safeParse(data))
}

export default biomarkerLogSchema
