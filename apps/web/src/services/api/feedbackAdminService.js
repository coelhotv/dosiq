// apps/web/src/services/api/feedbackAdminService.js
// Feedback Admin Service - Cliente de API do frontend para administração de feedbacks

import { supabase } from '@shared/utils/supabase'
import { parseISO } from '@utils/dateUtils'

export const feedbackAdminService = {
  /**
   * Obtém o token de autorização da sessão atual
   * @returns {Promise<string|null>} Token de acesso ou null se não autenticado
   */
  async _getAuthToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  },

  /**
   * Lista feedbacks com paginação e filtros
   * @param {Object} options - Filtros e opções de paginação
   * @param {number} options.limit - Itens por página
   * @param {number} options.offset - Offset
   * @param {boolean} options.is_resolved - Filtrar por status de resolução (opcional)
   * @param {number} options.rating - Filtrar por nota de 1 a 5 (opcional)
   * @returns {Promise<{data: Array, total: number, page: number, pageSize: number, totalPages: number}>} Resposta paginada
   */
  async getAll({ limit = 20, offset = 0, is_resolved = null, rating = null } = {}) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado. Faça login para acessar o painel de feedbacks.')
    }

    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())

    if (is_resolved !== null) {
      params.append('is_resolved', is_resolved.toString())
    }

    if (rating !== null) {
      params.append('rating', rating.toString())
    }

    const response = await fetch(`/api/feedbacks?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      if (response.status === 401) {
        throw new Error('Não autorizado. Apenas administradores podem acessar os feedbacks.')
      }
      throw new Error(error.error || 'Falha ao carregar feedbacks')
    }

    return response.json()
  },

  /**
   * Marca um feedback como resolvido ou não resolvido
   * @param {string} id - UUID do feedback
   * @param {boolean} is_resolved - Status de resolução
   * @returns {Promise<{success: boolean, data: Object}>} Resposta da API
   */
  async resolve(id, is_resolved) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado. Faça login para acessar o painel de feedbacks.')
    }

    const response = await fetch(`/api/feedbacks/${id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_resolved }),
    })

    const result = await response.json()

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado. Apenas administradores podem gerenciar feedbacks.')
      }
      throw new Error(result.error || 'Falha ao atualizar estado do feedback')
    }

    return result
  },

  /**
   * Formata data para exibição
   * @param {string} dateString - ISO date string
   * @returns {string} Data formatada em PT-BR
   */
  formatDate(dateString) {
    if (!dateString) return '-'
    return parseISO(dateString).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  },

  /**
   * Formata plataforma para exibição
   * @param {string} platform - Plataforma ('ios', 'android', 'other')
   * @returns {string} Plataforma formatada
   */
  formatPlatform(platform) {
    const platforms = {
      ios: 'iOS',
      android: 'Android',
      other: 'Outro',
    }
    return platforms[platform] || platform || 'Desconhecido'
  },
}

export default feedbackAdminService
