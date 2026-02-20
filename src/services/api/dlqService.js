// src/services/api/dlqService.js
// Dead Letter Queue Service - Frontend API client for DLQ admin

import { supabase } from '../../lib/supabase'

/**
 * DLQ Service - Gerencia operações da Dead Letter Queue
 *
 * Endpoints:
 * - GET /api/dlq - Lista notificações falhadas
 * - POST /api/dlq/[id]/retry - Retenta uma notificação
 * - POST /api/dlq/[id]/discard - Descarta uma notificação
 *
 * Autenticação:
 * - Usa o token de sessão do Supabase Auth
 * - Usuário deve ter telegram_chat_id igual ao ADMIN_CHAT_ID
 */
export const dlqService = {
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
   * Lista notificações falhadas com paginação
   * @param {Object} options - Opções de paginação e filtro
   * @param {number} options.limit - Itens por página (default: 20, max: 100)
   * @param {number} options.offset - Offset para paginação (default: 0)
   * @param {string} options.status - Filtrar por status (pending, retrying, resolved, discarded)
   * @returns {Promise<{data: Array, total: number, page: number, pageSize: number, totalPages: number}>}
   */
  async getAll({ limit = 20, offset = 0, status = null } = {}) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado. Faça login para acessar a DLQ.')
    }

    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())
    if (status) {
      params.append('status', status)
    }

    const response = await fetch(`/api/dlq?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      if (response.status === 401) {
        throw new Error('Não autorizado. Apenas administradores podem acessar a DLQ.')
      }
      throw new Error(error.error || 'Falha ao carregar DLQ')
    }

    return response.json()
  },

  /**
   * Retenta uma notificação falhada
   * @param {string} id - UUID da notificação
   * @returns {Promise<{success: boolean, message?: string, messageId?: string}>}
   */
  async retry(id) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado. Faça login para acessar a DLQ.')
    }

    const response = await fetch(`/api/dlq/${id}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado. Apenas administradores podem acessar a DLQ.')
      }
      throw new Error(result.error || 'Falha ao retentar notificação')
    }

    return result
  },

  /**
   * Descarta uma notificação falhada
   * @param {string} id - UUID da notificação
   * @param {string} reason - Motivo do descarte (opcional)
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async discard(id, reason = null) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado. Faça login para acessar a DLQ.')
    }

    const body = reason ? { reason } : {}

    const response = await fetch(`/api/dlq/${id}/discard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado. Apenas administradores podem acessar a DLQ.')
      }
      throw new Error(result.error || 'Falha ao descartar notificação')
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
    return new Date(dateString).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  },

  /**
   * Formata tipo de notificação para exibição
   * @param {string} type - Tipo da notificação
   * @returns {string} Tipo formatado
   */
  formatNotificationType(type) {
    const types = {
      dose_reminder: 'Lembrete de Dose',
      stock_alert: 'Alerta de Estoque',
      daily_digest: 'Resumo Diário',
      adherence_report: 'Relatório de Adesão',
      titration_alert: 'Alerta de Titulação',
      monthly_report: 'Relatório Mensal',
    }
    return types[type] || type || 'Desconhecido'
  },

  /**
   * Formata status para exibição
   * @param {string} status - Status da notificação
   * @returns {string} Status formatado
   */
  formatStatus(status) {
    const statuses = {
      pending: 'Pendente',
      retrying: 'Retentando',
      resolved: 'Resolvido',
      discarded: 'Descartado',
      failed: 'Falhou',
    }
    return statuses[status] || status || 'Desconhecido'
  },

  /**
   * Retorna cor CSS para o status
   * @param {string} status - Status da notificação
   * @returns {string} Classe CSS de cor
   */
  getStatusColor(status) {
    const colors = {
      pending: 'var(--color-warning)',
      retrying: 'var(--color-info)',
      resolved: 'var(--color-success)',
      discarded: 'var(--text-tertiary)',
      failed: 'var(--color-error)',
    }
    return colors[status] || 'var(--text-secondary)'
  },

  /**
   * Formata categoria de erro para exibição
   * @param {string} category - Categoria do erro
   * @returns {string} Categoria formatada
   */
  formatErrorCategory(category) {
    const categories = {
      network_error: 'Erro de Rede',
      rate_limit: 'Limite de Requisições',
      invalid_chat: 'Chat Inválido',
      message_too_long: 'Mensagem Longa',
      telegram_api_error: 'Erro da API Telegram',
      telegram_400: 'Requisição Inválida',
      telegram_401: 'Não Autorizado',
      telegram_403: 'Proibido',
      telegram_404: 'Não Encontrado',
      unknown: 'Desconhecido',
    }
    return categories[category] || category || 'Desconhecido'
  },
}

export default dlqService
