// packages/core/src/schemas/biomarkerLogSchema.js
// Schema de validação para biomarkers_log (012 Fase C · ADR-060)
//
// Modelo genérico: um shape serve glicemia/peso/pressão_arterial/batimentos e cresce sem migração.
// `type`/`source` extensíveis (ADR-060) — enum aqui é o guard v1 (DB não tem CHECK em type/source).
// `context` é domínio EXTENSÍVEL por família (ADR-070) — sem CHECK no DB; Zod é autoridade única,
// igual type/source. Zod valida a UNIÃO dos contextos; o refine cruza type↔família de contexto.
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

// Rótulo curto p/ cards (onde acompanha o valor). "Pressão" basta no BR ("medir a pressão").
// Só sobrescreve quando difere do label completo; o resolver cai no completo p/ o resto.
export const BIOMARKER_TYPE_SHORT_LABELS = {
  pressao_arterial: 'Pressão',
}

// Unidade fixa por tipo (a UI não deixa o usuário escolher unidade — FR-010).
export const BIOMARKER_TYPE_UNITS = {
  glicemia: 'mg/dL',
  peso: 'kg',
  pressao_arterial: 'mmHg',
  batimentos: 'bpm',
}

// Contexto da medida. ADR-070: `context` é domínio EXTENSÍVEL por família (sem CHECK no DB —
// Zod é autoridade única). A UI filtra por tipo; o Zod valida a UNIÃO; o refine cruza type↔família.

// Contexto de glicemia.
export const BIOMARKER_CONTEXTS = ['jejum', 'pre_refeicao', 'pos_refeicao', 'ao_deitar', 'outro']
export const BIOMARKER_CONTEXT_LABELS = {
  jejum: 'Jejum',
  pre_refeicao: 'Antes de comer',
  pos_refeicao: 'Depois de comer',
  ao_deitar: 'Ao deitar',
  outro: 'Outro',
}

// Contexto de pressão arterial (spec 032).
export const BIOMARKER_PA_CONTEXTS = ['ao_acordar', 'em_repouso', 'ao_dormir', 'apos_exercicio', 'pos_medicacao']
export const BIOMARKER_PA_CONTEXT_LABELS = {
  ao_acordar: 'Ao acordar',
  em_repouso: 'Em repouso',
  ao_dormir: 'Indo dormir',
  apos_exercicio: 'Após exercício',
  pos_medicacao: 'Após medicação',
}

// União aceita pelo Zod (o refine restringe por tipo).
export const BIOMARKER_ALL_CONTEXTS = [...BIOMARKER_CONTEXTS, ...BIOMARKER_PA_CONTEXTS]

// Mapa tipo → contextos válidos (refine + UI). Tipos ausentes = sem contexto.
export const BIOMARKER_CONTEXTS_BY_TYPE = {
  glicemia: BIOMARKER_CONTEXTS,
  pressao_arterial: BIOMARKER_PA_CONTEXTS,
}

// Origem do dado. v1 = manual; HealthSync futuro entra sem migração (ADR-060).
export const BIOMARKER_SOURCES = ['manual', 'healthkit', 'google_fit', 'health_connect']

const numericPositive = (msg) =>
  z.preprocess(
    (val) => (val === '' ? null : val),
    z.coerce.number({ error: msg }).positive(msg)
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

  // União de contextos (ADR-070); o refine restringe por tipo.
  context: z.enum(BIOMARKER_ALL_CONTEXTS).nullable().optional(),

  source: z.enum(BIOMARKER_SOURCES).default('manual'),

  notes: z
    .string()
    .max(500, 'A observação pode ter no máximo 500 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),
})

// Regras compostas (aplicadas separadamente — ZodEffects não expõe .partial(), R-274):
//  1. PA exige value_secondary; demais tipos não podem tê-lo.
//  2. context só vale p/ a família do tipo (BIOMARKER_CONTEXTS_BY_TYPE) — ADR-070: Zod é o guard
//     (sem CHECK no DB), então o cruzamento type↔família vive aqui.
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

    // Guard type↔família de contexto. context é opcional; só valida quando presente.
    if (data.context != null) {
      const allowed = BIOMARKER_CONTEXTS_BY_TYPE[data.type]
      if (!allowed || !allowed.includes(data.context)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['context'],
          message: 'Contexto inválido para este tipo de medida',
        })
      }
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
