import { useOnboarding } from './useOnboarding'
import Button from '@shared/components/ui/Button'
import './TelegramIntegrationStep.css'

export default function TelegramIntegrationStep() {
  const { completeOnboarding } = useOnboarding()

  const handleFinish = async () => {
    await completeOnboarding()
  }

  const botUsername = 'MeusRemediosBot'
  const botLink = `https://t.me/${botUsername}`

  return (
    <div className="telegram-step">
      <div className="step-header">
        <div className="step-icon telegram-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        </div>
        <h3 className="step-title">Lembretes no Telegram</h3>
        <p className="step-description">
          Conecte seu bot para receber notificações e gerenciar doses
        </p>
      </div>

      <div className="telegram-benefits">
        <div className="benefit-card">
          <div className="benefit-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="benefit-text">
            <h4>Lembretes Automáticos</h4>
            <p>Receba notificações nos horários certos</p>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="benefit-text">
            <h4>Registro Fácil</h4>
            <p>Confirme suas doses com um toque</p>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="benefit-text">
            <h4>Digests Diários</h4>
            <p>Resumo de doses tomadas no fim do dia</p>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="benefit-text">
            <h4>Alertas de Estoque</h4>
            <p>Notificações quando medicamentos estão no fim</p>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="benefit-text">
            <h4>Resumo Semanal</h4>
            <p>Análise da sua adesão e tendências</p>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="benefit-text">
            <h4>Relatórios Rápidos</h4>
            <p>Consulte seu histórico a qualquer momento</p>
          </div>
        </div>
      </div>

      <div className="telegram-setup">
        <div className="setup-instruction">
          <h4>Próximo passo</h4>
          <p>
            Após concluir, acesse <strong>Perfil → Telegram</strong> para conectar o bot
            <br />
            <a href={botLink} target="_blank" rel="noopener noreferrer" className="bot-link">
              @{botUsername}
            </a>
          </p>
        </div>

        <div className="setup-buttons">
          <Button onClick={handleFinish} className="btn-finish-onboarding">
            Concluir Onboarding
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="icon-right"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </Button>

          <button onClick={handleFinish} className="btn-skip-telegram">
            Pular por enquanto
          </button>
        </div>
      </div>
    </div>
  )
}
