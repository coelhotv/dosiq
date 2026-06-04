// apps/web/src/views/admin/FeedbackAdmin.jsx
// Painel administrativo para leitura e gestão de feedbacks dos usuários

import React from 'react'
import {
  Star,
  MessageSquare,
  Calendar,
  Smartphone,
  ArrowLeft,
  AlertCircle
} from 'lucide-react'
import Loading from '@shared/components/ui/Loading'
import Button from '@shared/components/ui/Button'
import feedbackAdminService from '@services/api/feedbackAdminService'
import { useFeedbackAdminState } from './useFeedbackAdminState'
import './FeedbackAdmin.css'

export default function FeedbackAdmin({ onBack }) {
  const {
    feedbacks,
    isLoading,
    error,
    total,
    page,
    totalPages,
    isResolvedFilter,
    setIsResolvedFilter,
    ratingFilter,
    setRatingFilter,
    stats,
    actionMessage,
    actionLoading,
    loadFeedbacks,
    handleResolveToggle,
    setPage
  } = useFeedbackAdminState()

  const renderStars = (rating) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={16}
          className={`feedback-admin__star ${i <= rating ? 'feedback-admin__star--filled' : ''}`}
        />
      )
    }
    return <div className="feedback-admin__rating">{stars}</div>
  }

  return (
    <div className="feedback-admin">
      <header className="feedback-admin__header">
        <div className="feedback-admin__title-area">
          <h1>Feedbacks de Usuários</h1>
          <p className="feedback-admin__subtitle">Avaliação do produto e sugestões de melhoria</p>
        </div>
        {onBack && (
          <button onClick={onBack} className="feedback-admin__back-btn" type="button">
            <ArrowLeft size={16} /> Voltar para Configurações
          </button>
        )}
      </header>

      {/* Estatísticas Globais */}
      <section className="feedback-admin__stats">
        <div className="feedback-admin__stat-card">
          <div className="feedback-admin__stat-icon">
            <MessageSquare size={24} />
          </div>
          <div className="feedback-admin__stat-info">
            <span className="feedback-admin__stat-value">{stats.totalCount}</span>
            <span className="feedback-admin__stat-label">Total Recebido</span>
          </div>
        </div>

        <div className="feedback-admin__stat-card">
          <div className="feedback-admin__stat-icon feedback-admin__stat-icon--warning">
            <AlertCircle size={24} />
          </div>
          <div className="feedback-admin__stat-info">
            <span className="feedback-admin__stat-value">{stats.pendingCount}</span>
            <span className="feedback-admin__stat-label">Não Resolvidos</span>
          </div>
        </div>

        <div className="feedback-admin__stat-card">
          <div className="feedback-admin__stat-icon feedback-admin__stat-icon--info">
            <Star size={24} />
          </div>
          <div className="feedback-admin__stat-info">
            <span className="feedback-admin__stat-value">
              {stats.avgRating > 0 ? `${stats.avgRating} / 5` : '-'}
            </span>
            <span className="feedback-admin__stat-label">Média Geral</span>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="feedback-admin__filters">
        <div className="feedback-admin__filters-group">
          <div className="feedback-admin__meta-item">
            <span className="feedback-admin__filter-label">Resolução:</span>
            <select
              value={isResolvedFilter}
              onChange={(e) => { setIsResolvedFilter(e.target.value); setPage(1) }}
              className="feedback-admin__select"
            >
              <option value="">Todos</option>
              <option value="false">Pendentes</option>
              <option value="true">Resolvidos</option>
            </select>
          </div>

          <div className="feedback-admin__meta-item">
            <span className="feedback-admin__filter-label">Avaliação:</span>
            <select
              value={ratingFilter}
              onChange={(e) => { setRatingFilter(e.target.value); setPage(1) }}
              className="feedback-admin__select"
            >
              <option value="">Todas</option>
              <option value="5">5 Estrelas</option>
              <option value="4">4 Estrelas</option>
              <option value="3">3 Estrelas</option>
              <option value="2">2 Estrelas</option>
              <option value="1">1 Estrela</option>
            </select>
          </div>
        </div>
        <div className="feedback-admin__pagination-info">
          Exibindo <strong>{feedbacks.length}</strong> de <strong>{total}</strong> feedbacks
        </div>
      </section>

      {/* Mensagem de confirmação de Ação */}
      {actionMessage && (
        <div className={`feedback-admin__message feedback-admin__message--${actionMessage.type}`}>
          {actionMessage.text}
        </div>
      )}

      {error && (
        <div className="feedback-admin__error">
          <p>Falha ao carregar dados: {error}</p>
          <Button onClick={loadFeedbacks} variant="secondary">
            Tentar Novamente
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="feedback-admin__loading">
          <Loading text="Buscando feedbacks de usuários..." />
        </div>
      )}

      {!isLoading && !error && feedbacks.length === 0 && (
        <div className="feedback-admin__empty">
          <MessageSquare size={48} className="feedback-admin__empty-icon" />
          <h3>Sem Feedbacks</h3>
          <p>Não há feedbacks pendentes para esta seleção no momento.</p>
          <Button onClick={loadFeedbacks} variant="secondary" size="sm">
            Atualizar Lista
          </Button>
        </div>
      )}

      {!isLoading && !error && feedbacks.length > 0 && (
        <>
          <div className="feedback-admin__list">
            {feedbacks.map((item) => {
              const userDisplayName = item.user_settings?.display_name || 'Usuário do Dosiq'
              const formattedDate = feedbackAdminService.formatDate(item.created_at)
              const platformLabel = feedbackAdminService.formatPlatform(item.platform)

              return (
                <article
                  key={item.id}
                  className={`feedback-admin__card ${
                    item.is_resolved
                      ? 'feedback-admin__card--resolved'
                      : 'feedback-admin__card--pending'
                  }`}
                >
                  <div className="feedback-admin__card-header">
                    <div className="feedback-admin__user-info">
                      <span className="feedback-admin__user-name">{userDisplayName}</span>
                      <div className="feedback-admin__meta-row">
                        <span className="feedback-admin__meta-item feedback-admin__mono">
                          <Calendar size={12} /> {formattedDate}
                        </span>
                        {item.device && (
                          <span className="feedback-admin__meta-item feedback-admin__mono">
                            <Smartphone size={12} /> {item.device}
                          </span>
                        )}
                        {item.app_version && (
                          <span className="feedback-admin__meta-item feedback-admin__mono">
                            v{item.app_version}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {renderStars(item.rating)}
                      <span
                        className={`feedback-admin__badge feedback-admin__badge--${item.platform}`}
                      >
                        {platformLabel}
                      </span>
                    </div>
                  </div>

                  <div className="feedback-admin__card-body">
                    <h2 className="feedback-admin__subject">{item.subject}</h2>
                    <p className="feedback-admin__comment">{item.comment}</p>
                  </div>

                  <div className="feedback-admin__card-footer">
                    <Button
                      onClick={() => handleResolveToggle(item.id, item.is_resolved)}
                      variant={item.is_resolved ? 'secondary' : 'primary'}
                      disabled={actionLoading === item.id}
                      size="sm"
                    >
                      {item.is_resolved ? 'Reabrir Feedback' : 'Marcar como Resolvido'}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="feedback-admin__pagination">
              <Button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                variant="secondary"
                size="sm"
              >
                Anterior
              </Button>
              <span className="feedback-admin__pagination-info">
                Página {page} de {totalPages}
              </span>
              <Button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
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
    </div>
  )
}
