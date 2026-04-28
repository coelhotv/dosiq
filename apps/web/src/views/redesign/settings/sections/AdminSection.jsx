import { Terminal, Database } from 'lucide-react'

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
      </div>
    </section>
  )
}
