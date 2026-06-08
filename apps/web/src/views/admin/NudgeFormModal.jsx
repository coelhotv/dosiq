// apps/web/src/views/admin/NudgeFormModal.jsx
// Modal form para criar/editar nudges

import React, { useState, useCallback } from 'react'
import Button from '@shared/components/ui/Button'
import DateTimePickerInput from '@shared/components/ui/DateTimePickerInput'
import {
  ACTION_TYPE_OPTIONS,
  ACTION_TYPE_LABELS,
  TARGET_VIEW_OPTIONS,
  TARGET_VIEW_LABELS,
  PLATFORM_OPTIONS,
  PLATFORM_LABELS,
} from '@dosiq/core/schemas/nudgeSchema'
import { parseLocalDatetime } from '@utils/dateUtils'
import { MOBILE_ROUTES } from './nudgeConstants'

export default function NudgeFormModal({ nudge, isOpen, onClose, onSubmit, isLoading }) {
  const [formData, setFormData] = useState(
    nudge || {
      title: '',
      body: '',
      target_view: 'dashboard',
      action_type: 'dismiss_only',
      platform: 'all',
      priority: 0,
      start_at: null,
      end_at: null,
      min_app_version: null,
      max_app_version: null,
      action_payload: {},
    }
  )

  const [errors, setErrors] = useState({})
  const isEditMode = !!nudge

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }, [errors])

  const handleActionPayloadChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      action_payload: {
        ...prev.action_payload,
        [field]: value,
      },
    }))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const newErrors = {}
    if (!formData.title) newErrors.title = 'Título obrigatório'
    if (!formData.body) newErrors.body = 'Corpo obrigatório'
    if (formData.title && formData.title.length > 100)
      newErrors.title = 'Máximo 100 caracteres'
    if (formData.body && formData.body.length > 200)
      newErrors.body = 'Máximo 200 caracteres'

    if (formData.start_at && formData.end_at) {
      if (new Date(formData.start_at) > new Date(formData.end_at)) {
        newErrors.dates = 'Data fim deve ser após data início'
      }
    }

    if (formData.action_type === 'navigate') {
      if (!formData.action_payload?.screen)
        newErrors.action_payload = 'Tela obrigatória para navegação'
    } else if (formData.action_type === 'open_url') {
      if (!formData.action_payload?.url) newErrors.action_payload = 'URL obrigatória'
      if (formData.action_payload?.url && !isValidUrl(formData.action_payload.url)) {
        newErrors.action_payload = 'URL inválida'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const submitData = {
      ...formData,
      start_at: formData.start_at ? parseLocalDatetime(formData.start_at).toISOString() : null,
      end_at: formData.end_at ? parseLocalDatetime(formData.end_at).toISOString() : null,
    }

    try {
      await onSubmit(submitData)
      onClose()
    } catch (err) {
      setErrors({ submit: err.message })
    }
  }

  if (!isOpen) return null

  return (
    <div className="nudges-admin__modal-overlay" onClick={onClose}>
      <div className="nudges-admin__modal" onClick={(e) => e.stopPropagation()}>
        <div className="nudges-admin__modal-header">
          <h2>{isEditMode ? 'Editar Nudge' : 'Criar Novo Nudge'}</h2>
          <button
            onClick={onClose}
            className="nudges-admin__modal-close"
            type="button"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="nudges-admin__form">
          {errors.submit && (
            <div className="nudges-admin__error-banner">{errors.submit}</div>
          )}

          <fieldset className="nudges-admin__form-section">
            <legend>Conteúdo</legend>

            <div className="form-group">
              <label htmlFor="title">
                Título <span className="required">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Ex: Nova Feature Disponível"
                maxLength={100}
                className={errors.title ? 'input-error' : ''}
              />
              <small>
                {formData.title.length}/100 caracteres
                {errors.title && ` — ${errors.title}`}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="body">
                Corpo <span className="required">*</span>
              </label>
              <textarea
                id="body"
                value={formData.body}
                onChange={(e) => handleChange('body', e.target.value)}
                placeholder="Ex: Confira nossa nova seção de análises..."
                maxLength={200}
                rows={3}
                className={errors.body ? 'input-error' : ''}
              />
              <small>
                {formData.body.length}/200 caracteres
                {errors.body && ` — ${errors.body}`}
              </small>
            </div>
          </fieldset>

          <fieldset className="nudges-admin__form-section">
            <legend>Direcionamento</legend>

            <div className="form-group-row">
              <div className="form-group">
                <label htmlFor="target_view">Tela Alvo</label>
                <select
                  id="target_view"
                  value={formData.target_view}
                  onChange={(e) => handleChange('target_view', e.target.value)}
                >
                  {TARGET_VIEW_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {TARGET_VIEW_LABELS[opt]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="action_type">Tipo de Ação</label>
                <select
                  id="action_type"
                  value={formData.action_type}
                  onChange={(e) => handleChange('action_type', e.target.value)}
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {ACTION_TYPE_LABELS[opt]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="platform">Plataforma</label>
                <select
                  id="platform"
                  value={formData.platform}
                  onChange={(e) => handleChange('platform', e.target.value)}
                >
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {PLATFORM_LABELS[opt]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="priority">Prioridade</label>
                <input
                  type="number"
                  id="priority"
                  value={formData.priority || 0}
                  onChange={(e) => handleChange('priority', parseInt(e.target.value) || 0)}
                  min={0}
                  max={100}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="nudges-admin__form-section">
            <legend>Ação Específica</legend>

            {formData.action_type === 'navigate' && (
              <div className="form-group">
                <label htmlFor="screen">
                  Tela para Navegar <span className="required">*</span>
                </label>
                <select
                  id="screen"
                  value={formData.action_payload?.screen || ''}
                  onChange={(e) => handleActionPayloadChange('screen', e.target.value)}
                  className={errors.action_payload ? 'input-error' : ''}
                >
                  <option value="">Selecione uma tela...</option>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  {Object.entries(MOBILE_ROUTES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {errors.action_payload && <small>{errors.action_payload}</small>}
              </div>
            )}

            {formData.action_type === 'open_url' && (
              <>
                <div className="form-group">
                  <label htmlFor="url">
                    URL <span className="required">*</span>
                  </label>
                  <input
                    type="url"
                    id="url"
                    value={formData.action_payload?.url || ''}
                    onChange={(e) => handleActionPayloadChange('url', e.target.value)}
                    placeholder="https://example.com"
                    className={errors.action_payload ? 'input-error' : ''}
                  />
                  {errors.action_payload && <small>{errors.action_payload}</small>}
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label htmlFor="label">Rótulo do Botão (opcional)</label>
                    <input
                      type="text"
                      id="label"
                      value={formData.action_payload?.label || ''}
                      onChange={(e) => handleActionPayloadChange('label', e.target.value)}
                      placeholder="Ex: Saiba Mais"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="emoji">Emoji (opcional)</label>
                    <input
                      type="text"
                      id="emoji"
                      maxLength={2}
                      value={formData.action_payload?.emoji || ''}
                      onChange={(e) => handleActionPayloadChange('emoji', e.target.value)}
                      placeholder="🎉"
                    />
                  </div>
                </div>
              </>
            )}

            {formData.action_type === 'dismiss_only' && (
              <div className="form-group">
                <div className="form-group-row">
                  <div className="form-group">
                    <label htmlFor="emoji-dismiss">Emoji (opcional)</label>
                    <input
                      type="text"
                      id="emoji-dismiss"
                      maxLength={2}
                      value={formData.action_payload?.emoji || ''}
                      onChange={(e) => handleActionPayloadChange('emoji', e.target.value)}
                      placeholder="👍"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.action_payload && Object.keys(formData.action_payload).length > 0 && (
              <div className="nudges-admin__json-preview">
                <label>Preview do Payload</label>
                <pre>{JSON.stringify(formData.action_payload, null, 2)}</pre>
              </div>
            )}
          </fieldset>

          <fieldset className="nudges-admin__form-section">
            <legend>Período de Exibição (opcional)</legend>

            <div className="form-group-row">
              <div className="form-group">
                <DateTimePickerInput
                  name="start_at"
                  label="Data/Hora Inicial"
                  value={formData.start_at}
                  onChange={(val) => handleChange('start_at', val)}
                />
              </div>

              <div className="form-group">
                <DateTimePickerInput
                  name="end_at"
                  label="Data/Hora Final"
                  value={formData.end_at}
                  onChange={(val) => handleChange('end_at', val)}
                />
              </div>
            </div>

            {errors.dates && <p className="nudges-admin__error-text">{errors.dates}</p>}
          </fieldset>

          <fieldset className="nudges-admin__form-section">
            <legend>Compatibilidade de Versão (opcional)</legend>

            <div className="form-group-row">
              <div className="form-group">
                <label htmlFor="min_version">Versão Mínima (X.Y.Z)</label>
                <input
                  type="text"
                  id="min_version"
                  value={formData.min_app_version || ''}
                  onChange={(e) => handleChange('min_app_version', e.target.value || null)}
                  placeholder="1.0.0"
                  pattern="\d+\.\d+\.\d+"
                />
              </div>

              <div className="form-group">
                <label htmlFor="max_version">Versão Máxima (X.Y.Z)</label>
                <input
                  type="text"
                  id="max_version"
                  value={formData.max_app_version || ''}
                  onChange={(e) => handleChange('max_app_version', e.target.value || null)}
                  placeholder="2.0.0"
                  pattern="\d+\.\d+\.\d+"
                />
              </div>
            </div>
          </fieldset>

          <div className="nudges-admin__form-actions">
            <Button onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Salvando...' : isEditMode ? 'Atualizar' : 'Criar Nudge'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function isValidUrl(string) {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}
