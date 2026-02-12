import './WelcomeStep.css'

export default function WelcomeStep() {
  return (
    <div className="welcome-step">
      <div className="welcome-illustration">
        <div className="illustration-icon">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="16" fill="#3b82f6" fillOpacity="0.1"/>
            <path d="M32 16C23.163 16 16 23.163 16 32s7.163 16 16 16 16-7.163 16-16S40.837 16 32 16zm0 28c-6.627 0-12-5.373-12-12s5.373-12 12-12 12 5.373 12 12-5.373 12-12 12z" fill="#3b82f6"/>
            <circle cx="32" cy="28" r="4" fill="#3b82f6"/>
            <path d="M32 34c-3.5 0-6.5 2-8 5h16c-1.5-3-4.5-5-8-5z" fill="#3b82f6"/>
            <path d="M48 24h4M48 32h4M48 40h4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
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
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Controle de Medicação</h4>
            <p>Cadastre seus medicamentos e acompanhe seus horários de forma organizada</p>
          </div>
        </div>

        <div className="benefit-item">
          <div className="benefit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Protocolos Personalizados</h4>
            <p>Crie rotinas de medicação com frequência e horários customizados</p>
          </div>
        </div>

        <div className="benefit-item">
          <div className="benefit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Lembretes Inteligentes</h4>
            <p>Receba notificações no Telegram e nunca esqueça sua medicação</p>
          </div>
        </div>

        <div className="benefit-item">
          <div className="benefit-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div className="benefit-content">
            <h4>Controle de Estoque</h4>
            <p>Monitore seu estoque e saiba quando é hora de repor seus medicamentos</p>
          </div>
        </div>
      </div>

      <div className="welcome-note">
        <p>
          <strong>🚀 Vamos começar?</strong>
          <br />
          Em poucos passos você terá seu primeiro medicamento cadastrado.
        </p>
      </div>
    </div>
  )
}