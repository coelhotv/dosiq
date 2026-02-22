import { z } from 'zod'

/**
 * Schema de validação para Reviews do Gemini Code Assist
 * Baseado na tabela 'gemini_reviews' do Supabase
 *
 * @module geminiReviewSchema
 */

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Status possíveis das reviews
 * @readonly
 */
export const REVIEW_STATUSES = ['pending', 'in_progress', 'fixed', 'discarded']

/**
 * Labels para exibição dos status
 * @readonly
 */
export const REVIEW_STATUS_LABELS = {
  pending: 'Pendente',
  in_progress: 'Em Progresso',
  fixed: 'Corrigido',
  discarded: 'Descartado',
}

/**
 * Prioridades possíveis
 * @readonly
 */
export const REVIEW_PRIORITIES = ['critical', 'high', 'medium', 'low']

/**
 * Labels para exibição das prioridades
 * @readonly
 */
export const REVIEW_PRIORITY_LABELS = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

/**
 * Categorias possíveis
 * @readonly
 */
export const REVIEW_CATEGORIES = ['style', 'bug', 'security', 'performance', 'maintainability']

/**
 * Labels para exibição das categorias
 * @readonly
 */
export const REVIEW_CATEGORY_LABELS = {
  style: 'Estilo',
  bug: 'Bug',
  security: 'Segurança',
  performance: 'Performance',
  maintainability: 'Manutenibilidade',
}

// ============================================================================
// SCHEMAS ZOD
// ============================================================================

/**
 * Schema base para review
 */
export const geminiReviewSchema = z.object({
  id: z.string().uuid().optional(),

  // Identificação do PR e commit
  pr_number: z.number().int().positive('Número do PR deve ser positivo'),
  commit_sha: z.string().min(1, 'Commit SHA é obrigatório'),

  // Localização do código
  file_path: z.string().min(1, 'Caminho do arquivo é obrigatório'),
  line_start: z.number().int().positive().nullable().optional(),
  line_end: z.number().int().positive().nullable().optional(),

  // Hash único
  issue_hash: z.string().min(1, 'Hash da issue é obrigatório'),

  // Status, prioridade e categoria
  status: z.enum(REVIEW_STATUSES, {
    errorMap: () => ({ message: 'Status inválido' }),
  }).default('pending'),

  priority: z.enum(REVIEW_PRIORITIES, {
    errorMap: () => ({ message: 'Prioridade inválida' }),
  }).nullable().optional(),

  category: z.enum(REVIEW_CATEGORIES, {
    errorMap: () => ({ message: 'Categoria inválida' }),
  }).nullable().optional(),

  // Conteúdo da review
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  suggestion: z.string().nullable().optional(),

  // Timestamps
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  resolved_at: z.string().datetime().nullable().optional(),

  // Referência ao usuário
  resolved_by: z.string().uuid().nullable().optional(),
})

/**
 * Schema para criação de review
 */
export const geminiReviewCreateSchema = geminiReviewSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  resolved_at: true,
})

/**
 * Schema para atualização de review (parcial)
 */
export const geminiReviewUpdateSchema = geminiReviewSchema.partial().omit({
  id: true,
  created_at: true,
  updated_at: true,
})

/**
 * Schema para atualização de status
 */
export const geminiReviewStatusUpdateSchema = z.object({
  status: z.enum(REVIEW_STATUSES, {
    errorMap: () => ({ message: 'Status inválido' }),
  }),
  resolved_by: z.string().uuid().nullable().optional(),
  resolved_at: z.string().datetime().nullable().optional(),
})

/**
 * Schema para filtros de listagem
 */
export const geminiReviewFiltersSchema = z.object({
  pr_number: z.number().int().positive().optional(),
  status: z.enum(REVIEW_STATUSES).optional(),
  category: z.enum(REVIEW_CATEGORIES).optional(),
  priority: z.enum(REVIEW_PRIORITIES).optional(),
})

/**
 * Schema completo com todas as validações
 */
export const geminiReviewFullSchema = geminiReviewSchema

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================================================

/**
 * Valida dados de uma review
 * @param {Object} data - Dados da review
 * @returns {Object} Resultado da validação { success, data, errors }
 */
export function validateGeminiReview(data) {
  const result = geminiReviewSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: null,
    }
  }

  return {
    success: false,
    data: null,
    errors: result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  }
}

/**
 * Valida dados para criação de review
 * @param {Object} data - Dados da review
 * @returns {Object} Resultado da validação { success, data, errors }
 */
export function validateGeminiReviewCreate(data) {
  const result = geminiReviewCreateSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: null,
    }
  }

  return {
    success: false,
    data: null,
    errors: result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  }
}

/**
 * Valida dados para atualização de review
 * @param {Object} data - Dados da review
 * @returns {Object} Resultado da validação { success, data, errors }
 */
export function validateGeminiReviewUpdate(data) {
  const result = geminiReviewUpdateSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: null,
    }
  }

  return {
    success: false,
    data: null,
    errors: result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  }
}

/**
 * Valida dados para atualização de status
 * @param {Object} data - Dados de status
 * @returns {Object} Resultado da validação { success, data, errors }
 */
export function validateGeminiReviewStatusUpdate(data) {
  const result = geminiReviewStatusUpdateSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: null,
    }
  }

  return {
    success: false,
    data: null,
    errors: result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  }
}

/**
 * Valida filtros de listagem
 * @param {Object} filters - Filtros
 * @returns {Object} Resultado da validação { success, data, errors }
 */
export function validateGeminiReviewFilters(filters) {
  const result = geminiReviewFiltersSchema.safeParse(filters)

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: null,
    }
  }

  return {
    success: false,
    data: null,
    errors: result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  }
}

// ============================================================================
// HELPERS DE ERRO
// ============================================================================

/**
 * Mapeia erros de validação para formato de formulário
 * @param {Array} errors - Array de erros do Zod
 * @returns {Object} Objeto com erros por campo
 */
export function mapGeminiReviewErrorsToForm(errors) {
  const formErrors = {}

  errors.forEach((error) => {
    const field = error.path[0]
    if (field) {
      formErrors[field] = error.message
    }
  })

  return formErrors
}

/**
 * Retorna mensagem de erro amigável
 * @param {Array} errors - Array de erros
 * @returns {string} Mensagem de erro
 */
export function getGeminiReviewErrorMessage(errors) {
  if (!errors || errors.length === 0) {
    return 'Erro de validação desconhecido'
  }

  const firstError = errors[0]
  return `${firstError.field}: ${firstError.message}`
}

// ============================================================================
// HELPERS DE STATUS
// ============================================================================

/**
 * Retorna o label do status
 * @param {string} status - Status da review
 * @returns {string} Label em português
 */
export function getStatusLabel(status) {
  return REVIEW_STATUS_LABELS[status] || status
}

/**
 * Retorna o label da prioridade
 * @param {string} priority - Prioridade da review
 * @returns {string} Label em português
 */
export function getPriorityLabel(priority) {
  return REVIEW_PRIORITY_LABELS[priority] || priority
}

/**
 * Retorna o label da categoria
 * @param {string} category - Categoria da review
 * @returns {string} Label em português
 */
export function getCategoryLabel(category) {
  return REVIEW_CATEGORY_LABELS[category] || category
}

/**
 * Verifica se o status é final (não pode ser alterado)
 * @param {string} status - Status da review
 * @returns {boolean} true se o status é final
 */
export function isFinalStatus(status) {
  return status === 'fixed' || status === 'discarded'
}
