import './WelcomeStep.css'

export default function WelcomeStep() {
  return (
    <div className="welcome-step">
      <div className="welcome-illustration">
        <div className="illustration-icon">
          <svg viewBox="0 0 64 64" className="welcome-ring">
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="var(--color-primary-light)"
              strokeWidth="6"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="6"
              strokeDasharray="0 163"
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              className="ring-arc"
            />
          </svg>
        </div>
      </div>

      <h2 className="welcome-title">Bem-vindo ao Meus Remédios!</h2>

      <p className="welcome-subtitle">
        Seu assistente pessoal para gerenciar medicamentos de forma simples e eficiente.
      </p>

      <div className="welcome-benefits">
        <div className="benefit-item">
          <div className="benefit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Health Score em tempo real</h4>
            <p>Acompanhe sua adesão com score visual, streak e evolução semanal</p>
          </div>
        </div>

        <div className="benefit-item">
          <div className="benefit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Doses organizadas por prioridade</h4>
            <p>Atrasadas, Agora, Próximas — sem precisar interpretar horários</p>
          </div>
        </div>

        <div className="benefit-item">
          <div className="benefit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a2 2 0 012-2h6a2 2 0 012 2v4" />
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Estoque visual com alertas inteligentes</h4>
            <p>Saiba de relance quando repor, com críticas em destaque</p>
          </div>
        </div>

        <div className="benefit-item">
          <div className="benefit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Base de 10.000+ medicamentos brasileiros</h4>
            <p>Autocomplete com dados ANVISA — nome, princípio ativo e laboratório</p>
          </div>
        </div>

        <div className="benefit-item">
          <div className="benefit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 2.2" />
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Lembretes proativos no Telegram</h4>
            <p>Digests diários, alertas de estoque e registro de doses sem abrir o app</p>
          </div>
        </div>
      </div>

      <div className="welcome-note">
        <p>100% gratuito. Seus dados ficam no seu perfil, protegidos.</p>
      </div>
    </div>
  )
}
