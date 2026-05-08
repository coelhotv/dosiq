import { Bell } from 'lucide-react'
import SettingsChannels from '@settings/components/SettingsChannels'
import SettingsQuietHours from '@settings/components/SettingsQuietHours'

export default function NotificationSection({
  webPushSupported,
  channelWebPushEnabled,
  savingChannel,
  handleToggleWebPush,
  isTelegramConnected,
  generateTelegramToken,
  telegramToken,
  handleDisconnectTelegram,
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

      <SettingsChannels
        webPushSupported={webPushSupported}
        channelWebPushEnabled={channelWebPushEnabled}
        savingChannel={savingChannel}
        handleToggleWebPush={handleToggleWebPush}
        isTelegramConnected={isTelegramConnected}
        generateTelegramToken={generateTelegramToken}
        telegramToken={telegramToken}
        handleDisconnectTelegram={handleDisconnectTelegram}
      />

      <div className="sr-section__card mt-4">
        <h4 className="sr-section__card-header">Modo de notificação</h4>
        {[
          { value: 'realtime', label: 'Tempo real', desc: 'Receba cada lembrete no momento certo' },
          { value: 'digest_morning', label: 'Resumo matinal', desc: 'Um resumo por dia no horário escolhido' },
          { value: 'silent', label: 'Silencioso', desc: 'Sem envios externos, apenas no app' },
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

      <SettingsQuietHours
        quietHoursEnabled={quietHoursEnabled}
        setQuietHoursEnabled={setQuietHoursEnabled}
        quietHoursStart={quietHoursStart}
        setQuietHoursStart={setQuietHoursStart}
        quietHoursEnd={quietHoursEnd}
        setQuietHoursEnd={setQuietHoursEnd}
        saveQuietHours={saveQuietHours}
        savingQuietHours={savingQuietHours}
      />

      {notificationMode === 'digest_morning' && (
        <div className="sr-section__card mt-4">
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
