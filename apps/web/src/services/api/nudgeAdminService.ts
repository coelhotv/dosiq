// apps/web/src/services/api/nudgeAdminService.js
// Nudge Admin Service — API cliente para gerenciar in-app banners

import { supabase } from '@shared/utils/supabase'

export const nudgeAdminService = {
  async _getAuthToken() {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
  },

  async getAll({ limit = 20, offset = 0, is_active = null, target_view = null } = {}) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado.')
    }

    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())

    if (is_active !== null) {
      params.append('is_active', is_active.toString())
    }

    if (target_view !== null) {
      params.append('target_view', target_view)
    }

    const response = await fetch(`/api/admin/nudges?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      if (response.status === 401) {
        throw new Error('Não autorizado.')
      }
      throw new Error(error.error || 'Falha ao carregar nudges')
    }

    return response.json()
  },

  async create(data) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado.')
    }

    const response = await fetch('/api/admin/nudges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      if (response.status === 401) {
        throw new Error('Não autorizado.')
      }
      throw new Error(error.error || 'Falha ao criar nudge')
    }

    return response.json()
  },

  async update(id, data) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado.')
    }

    const response = await fetch(`/api/admin/nudges/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      if (response.status === 401) {
        throw new Error('Não autorizado.')
      }
      throw new Error(error.error || 'Falha ao atualizar nudge')
    }

    return response.json()
  },

  async toggleActive(id, isActive) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado.')
    }

    const response = await fetch(`/api/admin/nudges/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_active: isActive }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      if (response.status === 401) {
        throw new Error('Não autorizado.')
      }
      throw new Error(error.error || 'Falha ao alternar nudge')
    }

    return response.json()
  },
}

export default nudgeAdminService
