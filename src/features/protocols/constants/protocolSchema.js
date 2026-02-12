import { z } from 'zod'

/**
 * Schema de validação para Protocolos
 * Baseado na tabela 'protocols' do Supabase
 */

// Frequências válidas (valores reais para o banco)
export const FREQUENCIES = ['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário']

// Labels de frequência para exibição
export const FREQUENCY_LABELS = {
  'diário': 'Diário',
  'dias_alternados': 'Dias Alternados',
  'semanal': 'Semanal',
  'personalizado': 'Personalizado',
  'quando_necessário': 'Quando Necessário'
}

// Status de titulação
const TITRATION_STATUSES = ['estável', 'titulando', 'alvo_atingido']

// Dias da semana
export const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

// Labels dos dias da semana para exibição
export const WEEKDAY_LABELS = {
  'segunda': 'Segunda-feira',
  'terça': 'Terça-feira',
  'quarta': 'Quarta-feira',
  'quinta': 'Quinta-feira',
  'sexta': 'Sexta-feira',
  'sábado': 'Sábado',
  'domingo': 'Domingo'
}

/**
 * Schema para um estágio de titulação
 */
export const titrationStageSchema = z.object({
  dosage: z
    .number()
    .positive('Dosagem do estágio deve ser maior que zero')
    .max(10000, 'Dosagem parece estar muito alta'),
  
  duration_days: z
    .number()
    .int('Duração deve ser um número inteiro')
    .min(1, 'Duração mínima é de 1 dia')
    .max(365, 'Duração máxima é de 365 dias'),
  
  description: z
    .string()
    .max(500, 'Descrição não pode ter mais de 500 caracteres')
    .optional()
    .nullable(),
})

/**
 * Schema base para protocolo
 */
export const protocolSchema = z.object({
  medicine_id: z
    .string()
    .uuid('ID do medicamento deve ser um UUID válido'),
  
  treatment_plan_id: z
    .string()
    .uuid('ID do plano de tratamento deve ser um UUID válido')
    .optional()
    .nullable()
    .transform(val => val || null),
  
  name: z
    .string()
    .min(2, 'Nome do protocolo deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode ter mais de 200 caracteres')
    .trim(),
  
  frequency: z
    .enum(FREQUENCIES, {
      errorMap: () => ({ 
        message: 'Frequência inválida. Opções: diário, dias_alternados, semanal, personalizado, quando_necessário' 
      })
    }),
  
  time_schedule: z
    .array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM'))
    .min(1, 'Adicione pelo menos um horário')
    .max(10, 'Máximo de 10 horários permitidos'),
  
  dosage_per_intake: z
    .number()
    .positive('Dosagem por tomada deve ser maior que zero')
    .max(1000, 'Dosagem parece estar muito alta. Verifique o valor'),
  
  titration_status: z
    .enum(TITRATION_STATUSES, {
      errorMap: () => ({ 
        message: 'Status de titulação inválido. Opções: estável, titulando, alvo_atingido' 
      })
    })
    .default('estável'),
  
  titration_schedule: z
    .array(titrationStageSchema)
    .max(50, 'Máximo de 50 estágios de titulação permitidos')
    .optional()
    .default([]),
  
  current_stage_index: z
    .number()
    .int('Índice do estágio deve ser um número inteiro')
    .min(0, 'Índice não pode ser negativo')
    .default(0),
  
  stage_started_at: z
    .string()
    .datetime('Data de início do estágio deve ser uma data válida (ISO 8601)')
    .optional()
    .nullable()
    .transform(val => val || null),
  
  active: z
    .boolean()
    .default(true),
  
  notes: z
    .string()
    .max(1000, 'Notas não podem ter mais de 1000 caracteres')
    .optional()
    .nullable()
    .transform(val => val || null),
})

/**
 * Schema para criação de protocolo
 */
export const protocolCreateSchema = protocolSchema.refine(
  (data) => {
    // Se tem titration_schedule, deve ter stage_started_at
    if (data.titration_schedule && data.titration_schedule.length > 0) {
      return data.titration_status === 'titulando' || data.titration_status === 'alvo_atingido'
    }
    return true
  },
  {
    message: 'Protocolo com cronograma de titulação deve ter status "titulando" ou "alvo_atingido"',
    path: ['titration_status'],
  }
).refine(
  (data) => {
    // Se está titulando, current_stage_index deve ser válido
    if (data.titration_schedule && data.titration_schedule.length > 0) {
      return data.current_stage_index < data.titration_schedule.length
    }
    return true
  },
  {
    message: 'Índice do estágio atual é maior que o número de estágios definidos',
    path: ['current_stage_index'],
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
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

/**
 * Valida um objeto de protocolo
 * @param {Object} data - Dados do protocolo
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateProtocol(data) {
  const result = protocolCreateSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
  
  return { success: false, errors }
}

/**
 * Valida dados para criação de protocolo
 * @param {Object} data - Dados do protocolo
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateProtocolCreate(data) {
  return validateProtocol(data)
}

/**
 * Valida dados para atualização de protocolo
 * @param {Object} data - Dados do protocolo
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateProtocolUpdate(data) {
  const result = protocolUpdateSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
  
  return { success: false, errors }
}

/**
 * Valida um estágio de titulação individual
 * @param {Object} stage - Dados do estágio
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateTitrationStage(stage) {
  const result = titrationStageSchema.safeParse(stage)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
  
  return { success: false, errors }
}

/**
 * Converte erros do Zod para formato amigável para formulários
 * @param {Array} zodErrors - Array de erros do Zod
 * @returns {Object} Objeto com campo como chave e mensagem como valor
 */
export function mapProtocolErrorsToForm(zodErrors) {
  const formErrors = {}
  
  zodErrors.forEach(error => {
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
export function getProtocolErrorMessage(errors) {
  if (!errors || errors.length === 0) return ''
  
  if (errors.length === 1) {
    return errors[0].message
  }
  
  return `Existem ${errors.length} erros no formulário. Verifique os campos destacados.`
}

export default protocolSchema
