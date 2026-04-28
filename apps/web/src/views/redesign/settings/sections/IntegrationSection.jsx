import { Webhook, CheckCircle2, ArrowRight } from 'lucide-react'

/**
 * IntegrationSection — Configurações de integração com serviços externos (Telegram).
 */
export default function IntegrationSection({
  isTelegramConnected,
  generateTelegramToken,
  telegramToken,
  handleDisconnectTelegram,
}) {
  return (
    <section className="sr-section">
      <h3 className="sr-section__title">
        <Webhook size={24} /> Integrações
      </h3>

      <div className="sr-section__card">
        <h3 className="sr-section__card-header">Telegram</h3>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', opacity: 0.6 }}>
          Receba lembretes de medicação e alertas diretamente no seu chat.
        </p>

        {!isTelegramConnected ? (
          <>
            <button
              className="sr-telegram__button sr-telegram__button--primary"
              onClick={generateTelegramToken}
              type="button"
            >
              Gerar Código de Vínculo
            </button>
            {telegramToken && (
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0 0 0.5rem 0' }}>
                  Envie ao bot:{' '}
                  <code
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(0,0,0,0.05)',
                      padding: '2px 4px',
                      borderRadius: '3px',
                    }}
                  >
                    /start {telegramToken}
                  </code>
                </p>
                <a
                  href="https://t.me/dosiq_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sr-telegram__link"
                >
                  Abrir no Telegram <ArrowRight size={14} style={{ marginLeft: 4 }} />
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="sr-telegram__badge sr-telegram__badge--connected">
              <CheckCircle2 size={14} style={{ marginRight: 6 }} /> Conectado
            </div>
            <button
              className="sr-telegram__button sr-telegram__button--danger"
              onClick={handleDisconnectTelegram}
              type="button"
            >
              Desconectar
            </button>
          </>
        )}
      </div>
    </section>
  )
}
