import { supabase } from '@shared/utils/supabase'
import {
  validateGeminiReviewCreate,
  validateGeminiReviewUpdate,
  validateGeminiReviewStatusUpdate,
  validateGeminiReviewFilters,
} from '@schemas/geminiReviewSchema'

/**
 * Gemini Review Service - Controle de reviews do Gemini Code Assist
 *
 * Este service gerencia o estado das reviews identificadas pelo Gemini,
 * permitindo rastreamento e atualização de issues de código.
 *
 * @module geminiReviewService
 */
export const geminiReviewService = {
  /**
   * Lista reviews com filtros opcionais
   * @param {Object} filters - Filtros de busca
   * @param {number} [filters.pr_number] - Número do PR
   * @param {string} [filters.status] - Status: 'pendente', 'em_progresso', 'corrigido', 'descartado'
   * @param {string} [filters.category] - Categoria: 'estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade'
   * @param {string} [filters.priority] - Prioridade: 'critica', 'alta', 'media', 'baixa'
   * @returns {Promise<Array>} Lista de reviews
   * @throws {Error} Se houver erro na consulta
   */
  async listReviews(filters = {}) {
    // Validar filtros
    const validation = validateGeminiReviewFilters(filters)
    if (!validation.success) {
      throw new Error(`Filtros inválidos: ${validation.errors.map((e) => e.message).join(', ')}`)
    }

    let query = supabase
      .from('gemini_reviews')
      .select('*')
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (filters.pr_number) {
      query = query.eq('pr_number', filters.pr_number)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.category) {
      query = query.eq('category', filters.category)
    }

    if (filters.priority) {
      query = query.eq('priority', filters.priority)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao listar reviews:', error)
      throw new Error('Não foi possível carregar as reviews')
    }

    return data || []
  },

  /**
   * Busca uma review pelo ID
   * @param {string} id - UUID da review
   * @returns {Promise<Object>} Dados da review
   * @throws {Error} Se não encontrar ou houver erro
   */
  async getReviewById(id) {
    if (!id) {
      throw new Error('ID da review é obrigatório')
    }

    const { data, error } = await supabase
      .from('gemini_reviews')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Review não encontrada')
      }
      console.error('Erro ao buscar review:', error)
      throw new Error('Não foi possível carregar a review')
    }

    return data
  },

  /**
   * Cria uma nova review
   * @param {Object} reviewData - Dados da review
   * @returns {Promise<Object>} Review criada
   * @throws {Error} Se dados forem inválidos ou houver erro no banco
   */
  async createReview(reviewData) {
    // Validar dados
    const validation = validateGeminiReviewCreate(reviewData)
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
      throw new Error(`Dados inválidos: ${errorMessage}`)
    }

    const { data, error } = await supabase
      .from('gemini_reviews')
      .insert(validation.data)
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar review:', error)
      throw new Error('Não foi possível criar a review')
    }

    return data
  },

  /**
   * Cria múltiplas reviews em lote
   * @param {Array<Object>} reviewsData - Array de dados das reviews
   * @returns {Promise<Array>} Reviews criadas
   * @throws {Error} Se houver erro na criação
   */
  async createReviewsBatch(reviewsData) {
    if (!Array.isArray(reviewsData) || reviewsData.length === 0) {
      throw new Error('É necessário fornecer um array de reviews')
    }

    // Validar todas as reviews
    const validatedReviews = []
    for (const reviewData of reviewsData) {
      const validation = validateGeminiReviewCreate(reviewData)
      if (!validation.success) {
        const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
        throw new Error(`Dados inválidos em review: ${errorMessage}`)
      }
      validatedReviews.push(validation.data)
    }

    const { data, error } = await supabase
      .from('gemini_reviews')
      .insert(validatedReviews)
      .select()

    if (error) {
      console.error('Erro ao criar reviews em lote:', error)
      throw new Error('Não foi possível criar as reviews')
    }

    return data || []
  },

  /**
   * Atualiza uma review existente
   * @param {string} id - UUID da review
   * @param {Object} updateData - Dados para atualização
   * @returns {Promise<Object>} Review atualizada
   * @throws {Error} Se dados forem inválidos ou houver erro
   */
  async updateReview(id, updateData) {
    if (!id) {
      throw new Error('ID da review é obrigatório')
    }

    // Validar dados
    const validation = validateGeminiReviewUpdate(updateData)
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
      throw new Error(`Dados inválidos: ${errorMessage}`)
    }

    const { data, error } = await supabase
      .from('gemini_reviews')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar review:', error)
      throw new Error('Não foi possível atualizar a review')
    }

    return data
  },

  /**
   * Atualiza o status de uma review
   * @param {string} id - UUID da review
   * @param {string} status - Novo status: 'pendente', 'em_progresso', 'corrigido', 'descartado'
   * @param {string} [resolvedBy] - UUID do usuário que resolveu (opcional)
   * @returns {Promise<Object>} Review atualizada
   * @throws {Error} Se dados forem inválidos ou houver erro
   */
  async updateReviewStatus(id, status, resolvedBy = null) {
    if (!id) {
      throw new Error('ID da review é obrigatório')
    }

    const updateData = {
      status,
      resolved_by: resolvedBy,
    }

    // Se status for final, adicionar resolved_at
    if (status === 'corrigido' || status === 'descartado') {
      updateData.resolved_at = new Date().toISOString()
    } else {
      updateData.resolved_at = null
    }

    // Validar dados
    const validation = validateGeminiReviewStatusUpdate(updateData)
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
      throw new Error(`Dados inválidos: ${errorMessage}`)
    }

    const { data, error } = await supabase
      .from('gemini_reviews')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar status da review:', error)
      throw new Error('Não foi possível atualizar o status da review')
    }

    return data
  },

  /**
   * Atualiza o status de múltiplas reviews em lote
   * @param {Array<string>} ids - Array de UUIDs das reviews
   * @param {string} status - Novo status
   * @returns {Promise<Array>} Reviews atualizadas
   * @throws {Error} Se houver erro na atualização
   */
  async batchUpdateStatus(ids, status) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('É necessário fornecer um array de IDs')
    }

    const updateData = { status }

    // Se status for final, adicionar resolved_at
    if (status === 'corrigido' || status === 'descartado') {
      updateData.resolved_at = new Date().toISOString()
    }

    // Validar status
    const validation = validateGeminiReviewStatusUpdate(updateData)
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
      throw new Error(`Status inválido: ${errorMessage}`)
    }

    const { data, error } = await supabase
      .from('gemini_reviews')
      .update(validation.data)
      .in('id', ids)
      .select()

    if (error) {
      console.error('Erro ao atualizar status em lote:', error)
      throw new Error('Não foi possível atualizar os status')
    }

    return data || []
  },

  /**
   * Obtém estatísticas de reviews por PR
   * @param {number} prNumber - Número do PR
   * @returns {Promise<Object>} Estatísticas
   * @throws {Error} Se houver erro na consulta
   */
  async getStats(prNumber) {
    if (!prNumber || typeof prNumber !== 'number') {
      throw new Error('Número do PR é obrigatório e deve ser um número')
    }

    // Buscar todas as reviews do PR
    const { data, error } = await supabase
      .from('gemini_reviews')
      .select('status, priority, category')
      .eq('pr_number', prNumber)

    if (error) {
      console.error('Erro ao buscar estatísticas:', error)
      throw new Error('Não foi possível carregar as estatísticas')
    }

    const reviews = data || []

    // Calcular estatísticas
    const stats = {
      total: reviews.length,
      byStatus: {
        pending: 0,
        in_progress: 0,
        fixed: 0,
        discarded: 0,
      },
      byPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unset: 0,
      },
      byCategory: {
        style: 0,
        bug: 0,
        security: 0,
        performance: 0,
        maintainability: 0,
        unset: 0,
      },
    }

    reviews.forEach((review) => {
      // Contagem por status
      if (stats.byStatus[review.status] !== undefined) {
        stats.byStatus[review.status]++
      }

      // Contagem por prioridade
      if (review.priority) {
        stats.byPriority[review.priority]++
      } else {
        stats.byPriority.unset++
      }

      // Contagem por categoria
      if (review.category) {
        stats.byCategory[review.category]++
      } else {
        stats.byCategory.unset++
      }
    })

    // Calcular progresso
    const resolved = stats.byStatus.fixed + stats.byStatus.discarded
    stats.progress = stats.total > 0 ? Math.round((resolved / stats.total) * 100) : 0

    return stats
  },

  /**
   * Deleta uma review
   * @param {string} id - UUID da review
   * @returns {Promise<void>}
   * @throws {Error} Se houver erro na deleção
   */
  async deleteReview(id) {
    if (!id) {
      throw new Error('ID da review é obrigatório')
    }

    const { error } = await supabase
      .from('gemini_reviews')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao deletar review:', error)
      throw new Error('Não foi possível deletar a review')
    }
  },

  /**
   * Busca review por hash da issue (para evitar duplicatas)
   * @param {string} issueHash - Hash MD5 do código problemático
   * @returns {Promise<Object|null>} Review encontrada ou null
   * @throws {Error} Se houver erro na consulta
   */
  async getReviewByIssueHash(issueHash) {
    if (!issueHash) {
      throw new Error('Hash da issue é obrigatório')
    }

    const { data, error } = await supabase
      .from('gemini_reviews')
      .select('*')
      .eq('issue_hash', issueHash)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar review por hash:', error)
      throw new Error('Não foi possível buscar a review')
    }

    return data
  },
}

export default geminiReviewService
