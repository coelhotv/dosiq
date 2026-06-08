// apps/web/src/views/admin/NudgesAdmin.jsx
// Painel administrativo para gerenciar nudges (in-app banners)

import React, { useState, useCallback } from 'react'
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  ToggleRight,
  ToggleLeft,
} from 'lucide-react'
import { parseISO } from '@utils/dateUtils'
import Loading from '@shared/components/ui/Loading'
import Button from '@shared/components/ui/Button'
import { useNudgesAdminState } from './useNudgesAdminState'
import NudgeFormModal from './NudgeFormModal'
import {
  ACTION_TYPE_LABELS,
  TARGET_VIEW_OPTIONS,
  TARGET_VIEW_LABELS,
  PLATFORM_LABELS,
} from '@dosiq/core/schemas/nudgeSchema'
import './NudgesAdmin.css'

export default function NudgesAdmin({ onBack }) {
  const {
    nudges,
    isLoading,
    error,
    total,
    page,
    totalPages,
    isActiveFilter,
    setIsActiveFilter,
    targetViewFilter,
    setTargetViewFilter,
    actionMessage,
    actionLoading,
    loadNudges,
    handleCreate,
    handleUpdate,
    handleToggleActive,
    setPage,
  } = useNudgesAdminState()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedNudge, setSelectedNudge] = useState(null)

  const handleOpenCreate = useCallback(() => {
    setSelectedNudge(null)
    setIsModalOpen(true)
  }, [])

  const handleOpenEdit = useCallback((nudge) => {
    setSelectedNudge(nudge)
    setIsModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    setSelectedNudge(null)
  }, [])

  const handleFormSubmit = useCallback(
    async (data) => {
      if (selectedNudge) {
        await handleUpdate(selectedNudge.id, data)
      } else {
        await handleCreate(data)
      }
    },
    [selectedNudge, handleCreate, handleUpdate]
  )

  return (
    <div className="nudges-admin">
      <header className="nudges-admin__header">
        <div className="nudges-admin__title-area">
          <h1>Gerenciamento de Nudges</h1>
          <p className="nudges-admin__subtitle">
            Crie e configure banners in-app para engajar usuários
          </p>
        </div>
        {onBack && (
          <button onClick={onBack} className="nudges-admin__back-btn" type="button">
            <ArrowLeft size={16} /> Voltar
          </button>
        )}
      </header>

      {/* Botão Criar */}
      <div className="nudges-admin__toolbar">
        <Button onClick={handleOpenCreate} variant="primary" size="sm">
          <Plus size={16} /> Novo Nudge
        </Button>
      </div>

      {/* Filtros */}
      <section className="nudges-admin__filters">
        <div className="nudges-admin__filters-group">
          <div className="nudges-admin__meta-item">
            <span className="nudges-admin__filter-label">Status:</span>
            <select
              value={isActiveFilter}
              onChange={(e) => {
                setIsActiveFilter(e.target.value)
                setPage(1)
              }}
              className="nudges-admin__select"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>

          <div className="nudges-admin__meta-item">
            <span className="nudges-admin__filter-label">Tela Alvo:</span>
            <select
              value={targetViewFilter}
              onChange={(e) => {
                setTargetViewFilter(e.target.value)
                setPage(1)
              }}
              className="nudges-admin__select"
            >
              <option value="">Todas</option>
              {TARGET_VIEW_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {TARGET_VIEW_LABELS[opt]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="nudges-admin__pagination-info">
          Exibindo <strong>{nudges.length}</strong> de <strong>{total}</strong> nudges
        </div>
      </section>

      {/* Mensagem de Ação */}
      {actionMessage && (
        <div className={`nudges-admin__message nudges-admin__message--${actionMessage.type}`}>
          {actionMessage.text}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="nudges-admin__error">
          <p>Falha ao carregar dados: {error}</p>
          <Button onClick={loadNudges} variant="secondary" size="sm">
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="nudges-admin__loading">
          <Loading text="Carregando nudges..." />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && nudges.length === 0 && (
        <div className="nudges-admin__empty">
          <AlertCircle size={48} className="nudges-admin__empty-icon" />
          <h3>Sem Nudges</h3>
          <p>Crie seu primeiro nudge para começar a engajar usuários.</p>
          <Button onClick={handleOpenCreate} variant="secondary" size="sm">
            Criar Nudge
          </Button>
        </div>
      )}

      {/* Lista */}
      {!isLoading && !error && nudges.length > 0 && (
        <>
          <div className="nudges-admin__list">
            {nudges.map((nudge) => (
              <article
                key={nudge.id}
                className={`nudges-admin__card ${
                  nudge.is_active ? 'nudges-admin__card--active' : 'nudges-admin__card--inactive'
                }`}
              >
                <div className="nudges-admin__card-header">
                  <div className="nudges-admin__card-title">
                    <h3>{nudge.title}</h3>
                    <span className={`nudges-admin__badge nudges-admin__badge--${nudge.platform}`}>
                      {PLATFORM_LABELS[nudge.platform]}
                    </span>
                  </div>
                  <div className="nudges-admin__card-meta">
                    <span className="nudges-admin__priority">
                      Prioridade: {nudge.priority}
                    </span>
                  </div>
                </div>

                <div className="nudges-admin__card-body">
                  <p className="nudges-admin__body-text">{nudge.body}</p>

                  <div className="nudges-admin__card-details">
                    <span className="nudges-admin__detail">
                      Tela: {TARGET_VIEW_LABELS[nudge.target_view]}
                    </span>
                    <span className="nudges-admin__detail">
                      Ação: {ACTION_TYPE_LABELS[nudge.action_type]}
                    </span>
                    {nudge.start_at && (
                      <span className="nudges-admin__detail">
                        Início: {parseISO(nudge.start_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {nudge.end_at && (
                      <span className="nudges-admin__detail">
                        Fim: {parseISO(nudge.end_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {nudge.action_payload && Object.keys(nudge.action_payload).length > 0 && (
                    <div className="nudges-admin__payload-preview">
                      <details>
                        <summary>
                          <Eye size={14} /> Payload
                        </summary>
                        <pre>{JSON.stringify(nudge.action_payload, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </div>

                <div className="nudges-admin__card-footer">
                  <button
                    onClick={() => handleToggleActive(nudge.id, nudge.is_active)}
                    className="nudges-admin__toggle-btn"
                    type="button"
                    disabled={actionLoading === nudge.id}
                    title={nudge.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {nudge.is_active ? (
                      <ToggleRight size={20} className="toggle-on" />
                    ) : (
                      <ToggleLeft size={20} className="toggle-off" />
                    )}
                  </button>

                  <Button
                    onClick={() => handleOpenEdit(nudge)}
                    variant="secondary"
                    disabled={actionLoading === nudge.id}
                    size="sm"
                  >
                    <Edit size={14} /> Editar
                  </Button>

                  <Button
                    onClick={() => {
                      // TODO: implement delete after handleDelete is added to hook and API
                    }}
                    variant="secondary"
                    disabled={true}
                    size="sm"
                    title="Funcionalidade de exclusão em desenvolvimento"
                  >
                    <Trash2 size={14} /> Deletar
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="nudges-admin__pagination">
              <Button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                variant="secondary"
                size="sm"
              >
                Anterior
              </Button>
              <span className="nudges-admin__pagination-info">
                Página {page} de {totalPages}
              </span>
              <Button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                variant="secondary"
                size="sm"
              >
                Próximo
              </Button>
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      <NudgeFormModal
        nudge={selectedNudge}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleFormSubmit}
        isLoading={actionLoading === (selectedNudge?.id || 'create')}
      />
    </div>
  )
}
