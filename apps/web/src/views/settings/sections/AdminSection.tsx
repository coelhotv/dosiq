import { Terminal, Database, MessageSquare, Volume2, ShieldAlert } from 'lucide-react'

/**
 * AdminSection — Ferramentas administrativas e DLQ.
 * Só é exibida se o usuário for administrador.
 */
export default function AdminSection({ isAdmin, dlqCount, onNavigate }) {
  if (!isAdmin) return null

  return (
    <section className="sr-section">
      <h3 className="sr-section__title">
        <Terminal size={24} /> Administração
      </h3>

      <div className="sr-section__card">
        <h3 className="sr-section__card-header">Infraestrutura</h3>
        <button
          className="sr-admin__row"
          onClick={() => onNavigate('admin-dlq')}
          type="button"
        >
          <div className="sr-admin__label">
            <Database size={18} />
            <span>Mensagens na DLQ</span>
          </div>
          <span className={`sr-admin__badge ${dlqCount > 0 ? 'sr-admin__badge--warning' : ''}`}>
            {dlqCount}
          </span>
        </button>

        <button
          className="sr-admin__row"
          onClick={() => onNavigate('admin-feedbacks')}
          type="button"
        >
          <div className="sr-admin__label">
            <MessageSquare size={18} />
            <span>Feedbacks de Usuários</span>
          </div>
        </button>

        <button
          className="sr-admin__row"
          onClick={() => onNavigate('admin-nudges')}
          type="button"
        >
          <div className="sr-admin__label">
            <Volume2 size={18} />
            <span>Nudges (In-App)</span>
          </div>
        </button>

        <button
          className="sr-admin__row"
          onClick={() => onNavigate('admin-version-gate')}
          type="button"
        >
          <div className="sr-admin__label">
            <ShieldAlert size={18} />
            <span>Kill Switch de Versão</span>
          </div>
        </button>
      </div>
    </section>
  )
}
