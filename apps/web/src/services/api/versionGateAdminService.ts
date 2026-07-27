// apps/web/src/services/api/versionGateAdminService.ts
// Admin Service — leitura e escrita do kill switch de versão mínima (spec 051-A PR 1.5c).
//
// Endpoint único /api/admin?resource=versionGate (R-090 — sem função serverless nova). GET lista as
// 2 linhas semeadas; PATCH grava uma linha. A guarda de raio de impacto (S-7) mora no HANDLER: ao
// ativar sem `acknowledge_affected_devices`, o servidor recusa (409) e devolve a contagem real — este
// service repassa esse 409 como um objeto de "confirmação pendente", nunca calcula a contagem aqui.

import { supabase } from '@shared/utils/supabase'

export const versionGateAdminService = {
  async _getAuthToken() {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
  },

  async getAll() {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado.')
    }

    const response = await fetch('/api/admin?resource=versionGate', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      if (response.status === 401) {
        throw new Error('Não autorizado.')
      }
      throw new Error(error.error || 'Falha ao carregar o kill switch')
    }

    return response.json()
  },

  /**
   * Grava uma linha do gate. Repassa o 409 do handler (recusa por acknowledge ausente/errado) como
   * objeto estruturado — NUNCA lança nesse caso, pois é o caminho normal da cerimônia do PO-9, não um
   * erro de sistema. Erros de fato (401/400/404/500/503) continuam lançando.
   */
  async update(payload) {
    const token = await this._getAuthToken()
    if (!token) {
      throw new Error('Não autenticado.')
    }

    const response = await fetch('/api/admin?resource=versionGate', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    const body = await response.json().catch(() => ({ error: 'Erro desconhecido' }))

    if (response.status === 409) {
      return { confirmationRequired: true, ...body }
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado.')
      }
      throw new Error(body.error || 'Falha ao gravar o kill switch')
    }

    return { confirmationRequired: false, ...body }
  },
}

export default versionGateAdminService
