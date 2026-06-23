import { UserKey, ArrowRight, LogOut } from 'lucide-react'

/**
 * AccountSection — Segurança da conta e logout.
 */
export default function AccountSection({
  showPasswordForm,
  setShowPasswordForm,
  handleUpdatePassword,
  newPassword,
  setNewPassword,
  handleLogout,
}) {
  return (
    <>
      <section className="sr-section">
        <h3 className="sr-section__title">
          <UserKey size={24} /> Segurança
        </h3>

        <div className="sr-section__card">
          <h3 className="sr-section__card-header">Alterar Senha</h3>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', opacity: 0.5 }}>
            Última alteração: --
          </p>

          {!showPasswordForm ? (
            <button
              className="sr-password__toggle"
              onClick={() => setShowPasswordForm(true)}
              type="button"
            >
              Alterar <ArrowRight size={14} style={{ marginLeft: 4 }} />
            </button>
          ) : (
            <form className="sr-password__form" onSubmit={handleUpdatePassword}>
              <input
                type="password"
                className="sr-password__input"
                placeholder="Nova senha (mín. 6 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="submit" className="sr-password__button sr-password__button--primary">
                  Salvar
                </button>
                <button
                  type="button"
                  className="sr-password__button sr-password__button--secondary"
                  onClick={() => {
                    setShowPasswordForm(false)
                    setNewPassword('')
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <div className="sr-logout">
        <button className="sr-logout__btn" onClick={handleLogout} type="button">
          <LogOut size={18} />
          Sair da Conta
        </button>
      </div>
    </>
  )
}
