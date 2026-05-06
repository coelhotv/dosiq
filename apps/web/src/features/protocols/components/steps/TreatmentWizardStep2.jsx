import Button from '@shared/components/ui/Button'
import { FREQUENCIES, FREQUENCY_LABELS } from '@schemas/protocolSchema'

export default function TreatmentWizardStep2({
  protocolData,
  updateProtocol,
  addTime,
  removeTime,
  updateTime,
  availablePlans,
  planMode,
  setPlanMode,
  selectedPlanId,
  setSelectedPlanId,
  newPlanName,
  setNewPlanName,
  newPlanEmoji,
  setNewPlanEmoji,
  goBack,
  goNext,
  handleComplete,
  isProtocolValid,
}) {
  return (
    <div className="wizard__step">
      <h3 className="wizard__title">Como Tomar</h3>

      <label className="wizard__label">
        Frequência
        <select
          className="wizard__select"
          value={protocolData.frequency}
          onChange={(e) => updateProtocol('frequency', e.target.value)}
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABELS[f] || f}
            </option>
          ))}
        </select>
      </label>

      <div className="wizard__label">
        Horários
        {protocolData.time_schedule.map((time, i) => (
          <div key={i} className="wizard__time-row">
            <input
              type="time"
              className="wizard__input"
              value={time}
              onChange={(e) => updateTime(i, e.target.value)}
            />
            {protocolData.time_schedule.length > 1 && (
              <button className="wizard__remove-time" onClick={() => removeTime(i)}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button className="wizard__add-time" onClick={addTime}>
          + Adicionar horário
        </button>
      </div>

      <label className="wizard__label">
        Comprimidos por dose
        <input
          type="number"
          className="wizard__input"
          value={protocolData.dosage_per_intake}
          onChange={(e) => updateProtocol('dosage_per_intake', e.target.value)}
          min="1"
          max="100"
        />
      </label>

      <label className="wizard__label">
        Data de início
        <input
          type="date"
          className="wizard__input"
          value={protocolData.start_date}
          onChange={(e) => updateProtocol('start_date', e.target.value)}
        />
      </label>

      {/* Plano de tratamento */}
      <div className="wizard__label">
        Plano de tratamento (opcional)
        <div className="wizard__mode-toggle" style={{ marginTop: 6 }}>
          <button
            type="button"
            className={`wizard__mode-btn${planMode === 'none' ? ' wizard__mode-btn--active' : ''}`}
            onClick={() => setPlanMode('none')}
          >
            Nenhum
          </button>
          {availablePlans.length > 0 && (
            <button
              type="button"
              className={`wizard__mode-btn${planMode === 'existing' ? ' wizard__mode-btn--active' : ''}`}
              onClick={() => setPlanMode('existing')}
            >
              Plano existente
            </button>
          )}
          <button
            type="button"
            className={`wizard__mode-btn${planMode === 'new' ? ' wizard__mode-btn--active' : ''}`}
            onClick={() => setPlanMode('new')}
          >
            + Criar plano
          </button>
        </div>
        {planMode === 'existing' && (
          <select
            className="wizard__select"
            style={{ marginTop: 8 }}
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
          >
            <option value="">-- Escolha um plano --</option>
            {availablePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji || '📋'} {p.name}
              </option>
            ))}
          </select>
        )}
        {planMode === 'new' && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="wizard__input"
              style={{ flex: '0 0 48px', textAlign: 'center' }}
              value={newPlanEmoji}
              onChange={(e) => setNewPlanEmoji(e.target.value)}
              placeholder="📋"
              maxLength={2}
            />
            <input
              type="text"
              className="wizard__input"
              style={{ flex: 1 }}
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              placeholder="Nome do plano (ex: Hipertensão)"
            />
          </div>
        )}
      </div>

      <div className="wizard__actions">
        <Button variant="ghost" onClick={goBack}>
          ← Voltar
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            handleComplete(true)
          }}
        >
          Pular
        </Button>
        <Button variant="primary" onClick={goNext} disabled={!isProtocolValid}>
          Próximo →
        </Button>
      </div>
    </div>
  )
}
