export default function SettingsQuietHours({
  quietHoursEnabled,
  setQuietHoursEnabled,
  quietHoursStart,
  setQuietHoursStart,
  quietHoursEnd,
  setQuietHoursEnd,
  saveQuietHours,
  savingQuietHours,
}) {
  return (
    <div className="sr-section__card mt-4">
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
  )
}
