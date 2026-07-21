import { z } from 'zod'
import { getTodayLocal, parseLocalDate } from '../utils/dateUtils'

/**
 * Schema de validação para Protocolos
 * Baseado na tabela 'protocols' do Supabase
 */

// Reexporta getTodayLocal como getTodayDateString para manter a compatibilidade
export const getTodayDateString = getTodayLocal

// Frequências válidas (valores reais para o banco)
export const FREQUENCIES = [
  'diário',
  'dias_alternados',
  'semanal',
  'personalizado',
  'quando_necessário',
] as const

// Labels de frequência para exibição
export const FREQUENCY_LABELS = {
  diário: 'Diário',
  dias_alternados: 'Dias Alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessário: 'Quando Necessário',
}

// Dias da semana
export const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

// Labels dos dias da semana para exibição
export const WEEKDAY_LABELS = {
  segunda: 'Segunda-feira',
  terça: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sábado: 'Sábado',
  domingo: 'Domingo',
}

// 029 F6: `titrationStageSchema` (a etapa do jsonb N1) foi REMOVIDO junto com as colunas
// `protocols.titration_schedule|titration_status|current_stage_index|stage_started_at`.
// A escada agora é a entidade `titrations` + `titration_steps` (ADR-084).
// Os dois campos do estágio N1 que NÃO têm equivalente em `titration_steps` (colunas
// conferidas no banco 2026-07-21 — R-295) e a razão de não terem:
//   · `description` — nota por etapa: decisão de produto, "não migra" (spec 029 F1).
//     É o campo fantasma que o F2 declarou e o F3 pôs num select → o 42703 do #750 (AP-300).
//   · `requires_new_medicine` — deixou de ser flag: no N2 cada etapa tem `medicine_id`
//     próprio, então "esta etapa troca o medicamento" se LÊ da mudança de id entre
//     etapas vizinhas, não de um booleano paralelo que podia divergir (052/ADR-084).
// Não reintroduzir nenhum dos dois "pra compilar".
// Ele e o `validateTitrationStage` não tinham NENHUM consumidor de produção — só o
// próprio teste (a forma exata do `advanceTitrationStage` do AP-301: capacidade que
// parecia existir porque o código existia).

/**
 * Schema base para protocolo
 */
// Unidades de TOMADA (físicas) p/ líquidos — 022 + 'mg' (012 Fase B2, GLP-1).
// Sincronizado com CHECK protocols_intake_unit_check ('gotas','ml','UI','mg')
// (R-082/R-271). 'UI' maiúsculo. 'mg' = dose injetável GLP-1 sobre líquido mg/ml.
export const INTAKE_UNITS = ['gotas', 'ml', 'UI', 'mg']

export const INTAKE_UNIT_LABELS = {
  gotas: 'gotas',
  ml: 'ml',
  UI: 'UI',
  mg: 'mg',
}

export const protocolSchema = z.object({
  // Mensagem no vocabulário do usuário (Dona Maria): o único jeito de isto falhar na UI é não ter
  // escolhido o medicamento (medicine_id=''), não um UUID malformado. Não vazar "UUID" pra tela.
  medicine_id: z.string().uuid('Selecione o medicamento do tratamento.'),

  treatment_plan_id: z
    .string()
    .uuid('Plano de tratamento inválido. Recarregue e tente de novo.')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val || null)),

  name: z
    .string()
    .min(2, 'Nome do protocolo deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode ter mais de 200 caracteres')
    .trim(),

  frequency: z.enum(FREQUENCIES, {
    error:
      'Frequência inválida. Opções: diário, dias_alternados, semanal, personalizado, quando_necessário',
  }),

  time_schedule: z
    .array(
      z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM')
    )
    .min(1, 'Adicione pelo menos um horário')
    .max(10, 'Máximo de 10 horários permitidos'),

  dosage_per_intake: z
    .number()
    .positive('Dosagem por tomada deve ser maior que zero')
    .max(1000, 'Dosagem parece estar muito alta. Verifique o valor'),

  // 029 F6: os 4 campos de titulação N1 (`titration_status`, `titration_schedule`,
  // `current_stage_index`, `stage_started_at`) saíram daqui porque as COLUNAS foram
  // dropadas de `protocols`. Não é omissão a preencher: a escada é `titrations` +
  // `titration_steps` (ADR-084). Declarar qualquer um deles de volta aqui reintroduz
  // o payload que o repositório escrevia — e depois do DROP isso é `42703` em todo
  // cadastro de tratamento, web e mobile (R-295 / AP-300).

  active: z.boolean().default(true),

  notes: z
    .string()
    .max(1000, 'Notas não podem ter mais de 1000 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início deve estar no formato YYYY-MM-DD')
    .describe('Data de início do protocolo'),

  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de término deve estar no formato YYYY-MM-DD')
    .nullable()
    .optional()
    .describe('Data de término do protocolo (NULL se ativo)'),

  weekdays: z
    .array(z.enum(WEEKDAYS))
    .max(7, 'Máximo de 7 dias da semana')
    .optional()
    .default([]),

  critical_alarm: z.boolean().default(false),

  // Unidade física da tomada (gotas/ml/UI) — só p/ líquidos; NULL p/ sólidos (022).
  intake_unit: z.enum(INTAKE_UNITS).nullable().optional(),

  // Flag de contexto transiente injetado pelo form (derivado de dosage_unit LIKE '%/ml').
  // NÃO persistido — services selecionam campos explícitos. Existe só p/ o refine de líquido ver.
  _medicineIsLiquid: z.boolean().optional(),
})

/**
 * Schema para criação de protocolo
 */
export const protocolCreateSchema = protocolSchema
  .refine(
    (data) => {
      // Líquido (form injeta _medicineIsLiquid) exige intake_unit (gotas/ml/UI).
      if (data._medicineIsLiquid === true) {
        return !!data.intake_unit
      }
      return true
    },
    {
      message: 'Defina a unidade de tomada (gotas, ml, UI ou mg) para medicamentos líquidos.',
      path: ['intake_unit'],
    }
  )
  // 029 F6: os 2 refines que cruzavam `titration_schedule` × `titration_status` ×
  // `current_stage_index` morreram com as colunas. A coerência escada↔status agora é
  // invariante da entidade N2, garantida por CHECK no banco (`titrations`), não por Zod.
  .refine(
    (data) => {
      // Se end_date está definido, deve ser maior ou igual a start_date
      // Usa T00:00:00 para garantir timezone local (GMT-3 para Brasil)
      if (data.end_date && data.start_date) {
        return parseLocalDate(data.end_date) >= parseLocalDate(data.start_date)
      }
      return true
    },
    {
      message: 'Data de término deve ser maior ou igual à data de início',
      path: ['end_date'],
    }
  )
  .refine(
    (data) => {
      // Se a frequência for semanal ou personalizada, deve selecionar pelo menos um dia
      if (data.frequency === 'semanal' || data.frequency === 'personalizado') {
        return Array.isArray(data.weekdays) && data.weekdays.length > 0
      }
      return true
    },
    {
      message: 'Selecione pelo menos um dia da semana para esta frequência',
      path: ['weekdays'],
    }
  )

/**
 * Schema para atualização de protocolo (campos opcionais)
 */
export const protocolUpdateSchema = protocolSchema.partial()

/**
 * Schema completo com ID
 */
export const protocolFullSchema = protocolSchema.extend({
  id: z.string().uuid('ID do protocolo deve ser um UUID válido'),
  user_id: z.string().uuid('ID do usuário deve ser um UUID válido'),
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
})

/**
 * Valida um objeto de protocolo
 * @param {Object} data - Dados do protocolo
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateProtocol(data: unknown) {
  const result = protocolCreateSchema.safeParse(data)

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
 * Valida dados para criação de protocolo
 * @param {Object} data - Dados do protocolo
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateProtocolCreate(data: unknown) {
  return validateProtocol(data)
}

/**
 * Valida dados para atualização de protocolo
 * @param {Object} data - Dados do protocolo
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateProtocolUpdate(data: unknown) {
  const result = protocolUpdateSchema.safeParse(data)

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
export function mapProtocolErrorsToForm(zodErrors: Array<{ path?: Array<string | number>; field?: string; message: string }>) {
  const formErrors: Record<string, string> = {}

  zodErrors.forEach((error) => {
    const field = String(error.path?.[0] ?? error.field ?? 'general')
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
export function getProtocolErrorMessage(errors: Array<{ field?: string; message: string }>) {
  if (!errors || errors.length === 0) return ''

  if (errors.length === 1) {
    return errors[0].message
  }

  return `Existem ${errors.length} erros no formulário. Verifique os campos destacados.`
}

export default protocolSchema
