import { ArrowLeft } from 'lucide-react'

/**
 * SettingsHeader — Header da view de configurações com botão voltar e mensagens.
 * 
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback de navegação.
 * @param {string|null} props.message - Mensagem de sucesso.
 * @param {string|null} props.error - Mensagem de erro.
 */
export default function SettingsHeader({ onNavigate, message, error }) {
  return (
    <>
      <div className="sr-header">
        <button
          className="sr-header__back"
          onClick={() => onNavigate('dashboard')}
          type="button"
          aria-label="Voltar"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="sr-header__title">Configurações</h1>
      </div>

      {message && <div className="sr-message sr-message--success">{message}</div>}
      {error && <div className="sr-message sr-message--error">{error}</div>}
    </>
  )
}
