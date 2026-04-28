import { Bell, Smartphone, Globe, Send, Mail } from 'lucide-react'

/**
 * NotificationSection — Configurações de notificações e canais.
 */
export default function NotificationSection({
  webPushSupported,
  channelWebPushEnabled,
  savingChannel,
  handleToggleWebPush,
  isTelegramConnected,
  notificationMode,
  handleModeChange,
  savingNotification,
  quietHoursEnabled,
  setQuietHoursEnabled,
  quietHoursStart,
  setQuietHoursStart,
  quietHoursEnd,
  setQuietHoursEnd,
  saveQuietHours,
  savingQuietHours,
  digestTime,
  setDigestTime,
  saveDigestTime,
  savingDigestTime,
}) {
  return (
    <section className="sr-section">
      <h3 className="sr-section__title">
        <Bell size={24} /> Notificações
      </h3>

      {/* ── Canais ── */}
      <div className="sr-section__card">
        <h4 className="sr-section__card-header">Canais</h4>

        {/* App (push nativo) */}
        <div className="settings-row settings-row--info">
          <div className="settings-row-label">
            <span className="settings-row-icon">
              <Smartphone size={18} />
            </span>
            <div>
              <span className="settings-row-title">App (push)</span>
              <span className="settings-row-subtitle">Gerenciado pelo aplicativo móvel</span>
            </div>
          </div>
          <span className="settings-badge settings-badge--info">App</span>
        </div>

        {/* Web (PWA) */}
        <div className="settings-row">
          <div className="settings-row-label">
            <span className="settings-row-icon">
              <Globe size={18} />
            </span>
            <div>
              <span className="settings-row-title">Web (PWA)</span>
              <span className="settings-row-subtitle">
                {webPushSupported
                  ? channelWebPushEnabled
                    ? 'Ativo neste navegador'
                    : 'Inativo neste navegador'
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

        {/* Telegram */}
        <div className="settings-row settings-row--info">
          <div className="settings-row-label">
            <span className="settings-row-icon">
              <Send size={18} />
            </span>
            <div>
              <span className="settings-row-title">Telegram</span>
              <span className="settings-row-subtitle">Status de integração</span>
            </div>
          </div>
          <span
            className={`settings-badge ${
              isTelegramConnected ? 'settings-badge--success' : 'settings-badge--muted'
            }`}
          >
            {isTelegramConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>

        {/* Email */}
        <div className="settings-row settings-row--disabled">
          <div className="settings-row-label">
            <span className="settings-row-icon">
              <Mail size={18} />
            </span>
            <div>
              <span className="settings-row-title">Email</span>
              <span className="settings-row-subtitle">Em breve</span>
            </div>
          </div>
          <span className="settings-badge settings-badge--muted">Em breve</span>
        </div>
      </div>

      {/* ── Modo de notificação ── */}
      <div className="sr-section__card" style={{ marginTop: '1rem' }}>
        <h4 className="sr-section__card-header">Modo de notificação</h4>
        {[
          {
            value: 'realtime',
            label: 'Tempo real',
            desc: 'Receba cada lembrete no momento certo',
          },
          {
            value: 'digest_morning',
            label: 'Resumo matinal',
            desc: 'Um resumo por dia no horário escolhido',
          },
          {
            value: 'silent',
            label: 'Silencioso',
            desc: 'Sem envios externos, apenas no app',
          },
        ].map(({ value, label, desc }) => (
          <label key={value} className="settings-radio-row">
            <input
              type="radio"
              name="notification_mode"
              value={value}
              checked={notificationMode === value}
              onChange={() => handleModeChange(value)}
              disabled={savingNotification}
            />
            <div>
              <span className="settings-radio-label">{label}</span>
              <span className="settings-radio-desc">{desc}</span>
            </div>
          </label>
        ))}
      </div>

      {/* ── Não me incomode ── */}
      <div className="sr-section__card" style={{ marginTop: '1rem' }}>
        <div className="settings-row">
          <div className="settings-row-label">
            <span className="settings-row-title">Não me incomode</span>
            <span className="settings-row-subtitle">Silenciar notificações externas neste período</span>
          </div>
          <input
            type="checkbox"
            className="settings-toggle"
            checked={quietHoursEnabled}
            onChange={(e) => setQuietHoursEnabled(e.target.checked)}
            aria-label="Ativar não me incomode"
          />
        </div>
        {quietHoursEnabled && (
          <div className="settings-time-row">
            <label className="settings-time-label">
              Das{' '}
              <input
                type="time"
                className="settings-time-input"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </label>
            <span className="settings-time-sep">às</span>
            <label className="settings-time-label">
              <input
                type="time"
                className="settings-time-input"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </label>
            <button 
              className="settings-btn-save" 
              onClick={saveQuietHours} 
              type="button"
              disabled={savingQuietHours}
            >
              {savingQuietHours ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {/* ── Hora do resumo ── */}
      {notificationMode === 'digest_morning' && (
        <div className="sr-section__card" style={{ marginTop: '1rem' }}>
          <h4 className="sr-section__card-header">Hora do resumo</h4>
          <div className="settings-time-row">
            <label className="settings-time-label">
              Enviar às{' '}
              <input
                type="time"
                className="settings-time-input"
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
              />
            </label>
            <button 
              className="settings-btn-save" 
              onClick={saveDigestTime} 
              type="button"
              disabled={savingDigestTime}
            >
              {savingDigestTime ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
