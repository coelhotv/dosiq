// apps/web/src/views/admin/VersionGateAdmin.tsx
// Painel admin do kill switch de versão mínima (spec 051-A PR 1.5c).
//
// 🔴 EDIT-ONLY (RC3-2/F6): as 2 linhas (ios/android) vêm semeadas pela migração do 1.5a — sem
// create/delete/lista/empty state. Não é CRUD; não reproduz a estrutura do NudgeFormModal.
// 🔴 A UI só EXIBE a contagem que o SERVIDOR devolve na recusa 4xx (S-7) — nunca a calcula aqui.
// 🔴 Desativar é sempre barato e imediato (PO-9 guard) — sem a cerimônia de confirmação.

import { ArrowLeft, ShieldAlert, ShieldOff } from 'lucide-react'
import { parseISO } from '@utils/dateUtils'
import Loading from '@shared/components/ui/Loading'
import Button from '@shared/components/ui/Button'
import { useVersionGateAdminState } from './useVersionGateAdminState'
import './VersionGateAdmin.css'

function VersionGateCard({
  row,
  edit,
  pending,
  actionLoading,
  onFieldChange,
  onSubmit,
  onConfirm,
  onCancelConfirmation,
  onDeactivate,
}) {
  const busy = actionLoading === row.platform

  return (
    <article className={`version-gate-admin__card ${row.is_active ? 'version-gate-admin__card--active' : ''}`}>
      <div className="version-gate-admin__card-header">
        <h3>{row.platform === 'ios' ? 'iOS' : 'Android'}</h3>
        <span className={`version-gate-admin__badge ${row.is_active ? 'version-gate-admin__badge--active' : 'version-gate-admin__badge--inactive'}`}>
          {row.is_active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div className="version-gate-admin__field">
        <label htmlFor={`min-${row.platform}`}>Versão mínima (X.Y.Z)</label>
        <input
          id={`min-${row.platform}`}
          type="text"
          value={edit.min_supported_version}
          onChange={(e) => onFieldChange(row.platform, 'min_supported_version', e.target.value)}
          placeholder="0.29.0"
          disabled={busy}
        />
      </div>

      <div className="version-gate-admin__field">
        <label htmlFor={`msg-${row.platform}`}>Mensagem (texto puro, máx. 280)</label>
        <textarea
          id={`msg-${row.platform}`}
          value={edit.message}
          onChange={(e) => onFieldChange(row.platform, 'message', e.target.value)}
          maxLength={280}
          disabled={busy}
        />
      </div>

      <div className="version-gate-admin__field">
        <label htmlFor={`url-${row.platform}`}>Store URL</label>
        <input
          id={`url-${row.platform}`}
          type="text"
          value={edit.store_url}
          onChange={(e) => onFieldChange(row.platform, 'store_url', e.target.value)}
          placeholder="https://apps.apple.com/... ou https://play.google.com/..."
          disabled={busy}
        />
      </div>

      <label className="version-gate-admin__toggle-row">
        <input
          type="checkbox"
          checked={edit.is_active}
          onChange={(e) => onFieldChange(row.platform, 'is_active', e.target.checked)}
          disabled={busy}
        />
        Ativar bloqueio de boot
      </label>

      {pending && (
        <div className="version-gate-admin__confirmation">
          <ShieldAlert size={18} />
          <div>
            <p>
              <strong>{pending.affected_devices}</strong> devices ({row.platform}) ficariam bloqueados
              abaixo de <strong>{edit.min_supported_version}</strong>.
            </p>
            <p className="version-gate-admin__confirmation-meta">
              {pending.platform_installs > 0
                ? `São ${Math.round((pending.affected_devices / pending.platform_installs) * 100)}% das instalações ativas em ${row.platform} nos últimos 30 dias (${pending.affected_devices}/${pending.platform_installs}).`
                : `Nenhuma instalação ativa em ${row.platform} nos últimos 30 dias.`}
            </p>
            <div className="version-gate-admin__confirmation-actions">
              <Button onClick={() => onConfirm(row.platform)} variant="primary" size="sm" disabled={busy}>
                Confirmar ativação
              </Button>
              <Button onClick={() => onCancelConfirmation(row.platform)} variant="secondary" size="sm" disabled={busy}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="version-gate-admin__card-footer">
        <Button onClick={() => onSubmit(row.platform)} variant="primary" size="sm" disabled={busy}>
          Salvar
        </Button>
        {row.is_active && (
          <Button onClick={() => onDeactivate(row.platform)} variant="secondary" size="sm" disabled={busy}>
            <ShieldOff size={14} /> Desativar agora
          </Button>
        )}
      </div>

      {row.updated_at && (
        <p className="version-gate-admin__updated-at">
          Última atualização: {parseISO(row.updated_at).toLocaleString('pt-BR')}
        </p>
      )}
    </article>
  )
}

export default function VersionGateAdmin({ onBack }) {
  const {
    rows,
    isLoading,
    error,
    editState,
    pendingConfirmation,
    actionLoading,
    actionMessage,
    loadGate,
    updateField,
    submit,
    confirm,
    cancelConfirmation,
    deactivate,
  } = useVersionGateAdminState()

  return (
    <div className="version-gate-admin">
      <header className="version-gate-admin__header">
        <div className="version-gate-admin__title-area">
          <h1>Kill Switch de Versão</h1>
          <p className="version-gate-admin__subtitle">
            Bloqueia o boot de versões abaixo do mínimo suportado. Desativar é sempre imediato.
          </p>
        </div>
        {onBack && (
          <button onClick={onBack} className="version-gate-admin__back-btn" type="button">
            <ArrowLeft size={16} /> Voltar
          </button>
        )}
      </header>

      {actionMessage && (
        <div className={`version-gate-admin__message version-gate-admin__message--${actionMessage.type}`}>
          {actionMessage.text}
        </div>
      )}

      {error && (
        <div className="version-gate-admin__error">
          <p>Falha ao carregar dados: {error}</p>
          <Button onClick={loadGate} variant="secondary" size="sm">
            Tentar Novamente
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="version-gate-admin__loading">
          <Loading text="Carregando kill switch..." />
        </div>
      )}

      {!isLoading && !error && (
        <div className="version-gate-admin__list">
          {rows.map((row) => (
            <VersionGateCard
              key={row.platform}
              row={row}
              edit={editState[row.platform] || {}}
              pending={pendingConfirmation[row.platform]}
              actionLoading={actionLoading}
              onFieldChange={updateField}
              onSubmit={submit}
              onConfirm={confirm}
              onCancelConfirmation={cancelConfirmation}
              onDeactivate={deactivate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
