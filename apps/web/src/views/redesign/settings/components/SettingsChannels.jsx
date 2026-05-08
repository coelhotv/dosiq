import { Smartphone, Globe, Send, Mail, CheckCircle2, ArrowRight } from 'lucide-react'

export default function SettingsChannels({
  webPushSupported,
  channelWebPushEnabled,
  savingChannel,
  handleToggleWebPush,
  isTelegramConnected,
  generateTelegramToken,
  telegramToken,
  handleDisconnectTelegram,
}) {
  return (
    <div className="sr-section__card">
      <h4 className="sr-section__card-header">Canais</h4>

      <div className="settings-row settings-row--info">
        <div className="settings-row-label">
          <span className="settings-row-icon"><Smartphone size={18} /></span>
          <div>
            <span className="settings-row-title">App (push)</span>
            <span className="settings-row-subtitle">Gerenciado pelo aplicativo móvel</span>
          </div>
        </div>
        <span className="settings-badge settings-badge--info">App</span>
      </div>

      <div className="settings-row">
        <div className="settings-row-label">
          <span className="settings-row-icon"><Globe size={18} /></span>
          <div>
            <span className="settings-row-title">Web (PWA)</span>
            <span className="settings-row-subtitle">
              {webPushSupported
                ? channelWebPushEnabled ? 'Ativo neste navegador' : 'Inativo neste navegador'
                : 'Não suportado neste navegador'}
            </span>
          </div>
        </div>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={channelWebPushEnabled}
          disabled={!webPushSupported || savingChannel}
          onChange={handleToggleWebPush}
          aria-label="Ativar notificações Web (PWA)"
        />
      </div>

      <div className="settings-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="settings-row-label">
          <span className="settings-row-icon"><Send size={18} /></span>
          <div>
            <span className="settings-row-title">Telegram</span>
            <span className="settings-row-subtitle">
              {isTelegramConnected ? 'Receba lembretes no chat' : 'Conecte para receber lembretes'}
            </span>
          </div>
        </div>
        {isTelegramConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="settings-badge settings-badge--success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CheckCircle2 size={12} /> Conectado
            </span>
            <button
              className="sr-telegram__button sr-telegram__button--danger"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', minHeight: 'unset' }}
              onClick={handleDisconnectTelegram}
              type="button"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <button
              className="sr-telegram__button sr-telegram__button--primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={generateTelegramToken}
              type="button"
            >
              Gerar Código de Vínculo
            </button>
            {telegramToken && (
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
                Envie ao bot:{' '}
                <code style={{ background: 'var(--color-surface-container-high)', padding: '2px 4px', borderRadius: '3px' }}>
                  /start {telegramToken}
                </code>
                {' — '}
                <a
                  href="https://t.me/dosiq_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sr-telegram__link"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  Abrir no Telegram <ArrowRight size={12} />
                </a>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="settings-row settings-row--disabled">
        <div className="settings-row-label">
          <span className="settings-row-icon"><Mail size={18} /></span>
          <div>
            <span className="settings-row-title">Email</span>
            <span className="settings-row-subtitle">Em breve</span>
          </div>
        </div>
        <span className="settings-badge settings-badge--muted">Em breve</span>
      </div>
    </div>
  )
}
