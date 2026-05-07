import { Smartphone, Globe, Send, Mail } from 'lucide-react'

export default function SettingsChannels({
  webPushSupported,
  channelWebPushEnabled,
  savingChannel,
  handleToggleWebPush,
  isTelegramConnected,
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

      <div className="settings-row settings-row--info">
        <div className="settings-row-label">
          <span className="settings-row-icon"><Send size={18} /></span>
          <div>
            <span className="settings-row-title">Telegram</span>
            <span className="settings-row-subtitle">Status de integração</span>
          </div>
        </div>
        <span className={`settings-badge ${isTelegramConnected ? 'settings-badge--success' : 'settings-badge--muted'}`}>
          {isTelegramConnected ? 'Conectado' : 'Desconectado'}
        </span>
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
