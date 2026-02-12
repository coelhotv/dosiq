import { useState } from 'react'
import { useOnboarding } from './useOnboarding'
import Button from '../ui/Button'
import './TelegramIntegrationStep.css'

export default function TelegramIntegrationStep() {
  const { completeOnboarding } = useOnboarding()
  const [isConnecting, setIsConnecting] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const handleConnect = () => {
    setIsConnecting(true)
    // Simula o processo de conexão
    setTimeout(() => {
      setShowQR(true)
      setIsConnecting(false)
    }, 1000)
  }

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
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </div>
        <h3 className="step-title">Integração com Telegram</h3>
        <p className="step-description">
          Receba lembretes de medicação diretamente no seu Telegram
        </p>
      </div>

      <div className="telegram-benefits">
        <div className="benefit-card">
          <div className="benefit-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
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
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
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
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div className="benefit-text">
            <h4>Relatórios Rápidos</h4>
            <p>Consulte seu histórico a qualquer momento</p>
          </div>
        </div>
      </div>

      {!showQR ? (
        <div className="telegram-connect">
          <div className="connect-illustration">
            <div className="phone-mockup">
              <div className="phone-screen">
                <div className="notification">
                  <div className="notification-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">Meus Remédios</div>
                    <div className="notification-text">💊 Hora de tomar Paracetamol 500mg</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn-connect-telegram"
          >
            {isConnecting ? (
              <>
                <span className="spinner"></span>
                Conectando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Conectar com Telegram
              </>
            )}
          </Button>

          <button
            onClick={handleFinish}
            className="btn-skip-telegram"
          >
            Pular por enquanto
          </button>
        </div>
      ) : (
        <div className="telegram-qr-section">
          <div className="qr-container">
            <div className="qr-code">
              <svg viewBox="0 0 200 200" className="qr-placeholder">
                <rect fill="white" width="200" height="200"/>
                <g fill="black">
                  {/* QR Code Pattern Simulation */}
                  <rect x="10" y="10" width="50" height="50"/>
                  <rect x="15" y="15" width="40" height="40" fill="white"/>
                  <rect x="20" y="20" width="30" height="30"/>
                  
                  <rect x="140" y="10" width="50" height="50"/>
                  <rect x="145" y="15" width="40" height="40" fill="white"/>
                  <rect x="150" y="20" width="30" height="30"/>
                  
                  <rect x="10" y="140" width="50" height="50"/>
                  <rect x="15" y="145" width="40" height="40" fill="white"/>
                  <rect x="20" y="150" width="30" height="30"/>
                  
                  {/* Data modules */}
                  <rect x="70" y="10" width="10" height="10"/>
                  <rect x="90" y="10" width="10" height="10"/>
                  <rect x="110" y="10" width="10" height="10"/>
                  
                  <rect x="10" y="70" width="10" height="10"/>
                  <rect x="30" y="70" width="10" height="10"/>
                  <rect x="50" y="70" width="10" height="10"/>
                  
                  <rect x="70" y="70" width="60" height="60"/>
                  <rect x="80" y="80" width="40" height="40" fill="white"/>
                  <rect x="90" y="90" width="20" height="20"/>
                  
                  <rect x="140" y="70" width="10" height="10"/>
                  <rect x="160" y="70" width="10" height="10"/>
                  <rect x="180" y="70" width="10" height="10"/>
                  
                  <rect x="70" y="140" width="10" height="10"/>
                  <rect x="90" y="140" width="10" height="10"/>
                  <rect x="110" y="140" width="10" height="10"/>
                  
                  <rect x="140" y="140" width="10" height="10"/>
                  <rect x="160" y="160" width="10" height="10"/>
                  <rect x="180" y="140" width="10" height="10"/>
                </g>
              </svg>
            </div>
            <p className="qr-label">Escaneie com seu Telegram</p>
          </div>

          <div className="telegram-instructions">
            <ol>
              <li>Abra o Telegram no seu celular</li>
              <li>Vá em <strong>Configurações → Dispositivos</strong></li>
              <li>Clique em <strong>"Conectar Desktop"</strong></li>
              <li>Aponte a câmera para o QR code acima</li>
            </ol>
          </div>

          <div className="telegram-link">
            <p>Ou acesse diretamente:</p>
            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bot-link"
            >
              @{botUsername}
            </a>
          </div>

          <Button
            onClick={handleFinish}
            className="btn-finish-onboarding"
          >
            Concluir Configuração
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-right">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </Button>
        </div>
      )}
    </div>
  )
}