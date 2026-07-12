import { useEffect } from 'react'
import Button from '@shared/components/ui/Button'
import { FREQUENCIES, FREQUENCY_LABELS, INTAKE_UNIT_LABELS } from '@schemas/protocolSchema'
import { formatDoseHint } from '@dosiq/core'

const REQUIRES_WEEKDAYS = new Set(['semanal', 'personalizado'])

const VISUAL_ORDER = [
  { key: 'domingo', label: 'D' },
  { key: 'segunda', label: 'S' },
  { key: 'terça', label: 'T' },
  { key: 'quarta', label: 'Q' },
  { key: 'quinta', label: 'Q' },
  { key: 'sexta', label: 'S' },
  { key: 'sábado', label: 'S' },
]

/** Renderiza o seletor de plano de tratamento (nenhum, existente ou novo). */
function PlanSelector({ availablePlans, planMode, setPlanMode, selectedPlanId, setSelectedPlanId, newPlanName, setNewPlanName, newPlanEmoji, setNewPlanEmoji }) {
  return (
    <div className="wizard__label">
      Plano de tratamento (opcional)
      <div className="wizard__mode-toggle" style={{ marginTop: 6 }}>
        <button type="button" className={`wizard__mode-btn${planMode === 'none' ? ' wizard__mode-btn--active' : ''}`} onClick={() => setPlanMode('none')}>
          Nenhum
        </button>
        {availablePlans.length > 0 && (
          <button type="button" className={`wizard__mode-btn${planMode === 'existing' ? ' wizard__mode-btn--active' : ''}`} onClick={() => setPlanMode('existing')}>
            Plano existente
          </button>
        )}
        <button type="button" className={`wizard__mode-btn${planMode === 'new' ? ' wizard__mode-btn--active' : ''}`} onClick={() => setPlanMode('new')}>
          + Criar plano
        </button>
      </div>
      {planMode === 'existing' && (
        <select className="wizard__select" style={{ marginTop: 8 }} value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
          <option value="">-- Escolha um plano --</option>
          {availablePlans.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji || '📋'} {p.name}</option>
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
  )
}

function StepFrequencySelector({
  protocolData,
  updateProtocol,
  handleWeekdayToggle,
}) {
  return (
    <>
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

      {REQUIRES_WEEKDAYS.has(protocolData.frequency) && (
        <div className="wizard__label">
          Dias da Semana *
          <div className="weekday-selector-pwa">
            {VISUAL_ORDER.map(({ key, label }) => {
              const isSelected = (protocolData.weekdays || []).includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={`weekday-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleWeekdayToggle(key)}
                  aria-pressed={isSelected}
                  title={key.charAt(0).toUpperCase() + key.slice(1)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function StepTimeScheduleSelector({
  protocolData,
  updateTime,
  removeTime,
  addTime,
}) {
  return (
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
  )
}

function StepDosageSelector({
  protocolData,
  updateProtocol,
  isLiquid,
  defaultIntake,
  intakeOptions,
  askDensity,
  densityLabel,
  densityHint,
  defaultDensity,
  medicine,
}) {
  return (
    <label className="wizard__label">
      {isLiquid ? 'Dose por tomada' : 'Dose por tomada (un.)'}
      <input
        type="text"
        inputMode="decimal"
        className="wizard__input"
        value={protocolData.dosage_per_intake}
        onChange={(e) => updateProtocol('dosage_per_intake', e.target.value)}
      />
      {isLiquid && (
        <select
          className="wizard__select"
          style={{ marginTop: 6 }}
          value={protocolData.intake_unit || defaultIntake}
          onChange={(e) => updateProtocol('intake_unit', e.target.value)}
          aria-label="Unidade de tomada"
        >
          {intakeOptions.map((unit) => (
            <option key={unit} value={unit}>{INTAKE_UNIT_LABELS[unit] || unit}</option>
          ))}
        </select>
      )}
      {medicine && (
        <span className="helper-text active-ingredient-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          ✨ {formatDoseHint(protocolData.dosage_per_intake, protocolData.intake_unit, medicine)}
        </span>
      )}
      {askDensity && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            {densityLabel}
            <input
              type="text"
              inputMode="decimal"
              className="wizard__input"
              value={protocolData.units_per_ml}
              onChange={(e) => updateProtocol('units_per_ml', e.target.value)}
              placeholder={String(defaultDensity)}
            />
          </label>
          <small className="wizard__label-note">{densityHint}.</small>
        </div>
      )}
    </label>
  )
}

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
  medicine,
  stockTrackingEnabled = true,
}) {
  // Líquido := dosage_unit do medicamento termina em '/ml' (decisão-mãe 022).
  const isLiquid = Boolean(medicine?.dosage_unit?.endsWith('/ml'))
  // Default da unidade de tomada: gotas é a apresentação líquida mais comum (mg é
  // exceção do GLP-1 — o usuário troca p/ mg manualmente). ui/ml → 'UI'. resto → 'gotas'.
  const defaultIntake = medicine?.dosage_unit === 'ui/ml' ? 'UI' : 'gotas'
  const isMg = protocolData.intake_unit === 'mg'
  // Densidade (units_per_ml) só p/ gotas/UI (razão física sub-ml). mg usa a
  // CONCENTRAÇÃO já cadastrada no medicamento (dosage_per_pill = mg/ml) — não pede nada.
  const needsDensity =
    isLiquid && protocolData.intake_unit && protocolData.intake_unit !== 'ml' && !isMg
  const densityLabel = protocolData.intake_unit === 'UI' ? 'UI por ml' : 'Gotas por ml'
  const densityHint =
    protocolData.intake_unit === 'UI' ? 'Geralmente 100 UI por ml' : 'Geralmente 20 gotas por ml'
  const defaultDensity = protocolData.intake_unit === 'UI' ? 100 : 20
  // Densidade (units_per_ml) já vive no medicamento (decisão 022) — gotas/UI herdam.
  const inheritedDensity = Number(medicine?.units_per_ml) > 0 ? medicine.units_per_ml : null
  const askDensity = needsDensity && !inheritedDensity
  // Unidades de tomada por forma (022 + B2): ui/ml → {UI, gotas}; mg/ml → {mg, ml, gotas}; resto → {gotas, ml}.
  const intakeOptions =
    medicine?.dosage_unit === 'ui/ml'
      ? ['UI', 'gotas']
      : medicine?.dosage_unit === 'mg/ml'
        ? ['gotas', 'ml', 'mg']
        : ['gotas', 'ml']

  // Preenche intake_unit p/ líquidos (evita null silencioso no débito de estoque).
  useEffect(() => {
    if (isLiquid && !protocolData.intake_unit) {
      updateProtocol('intake_unit', defaultIntake)
    }
  }, [isLiquid, protocolData.intake_unit, defaultIntake, updateProtocol])

  // Densidade do formulário: herda do medicamento se já cadastrada (não repergunta);
  // senão prefilla o default conveniente de gotas/UI. mg sem herança fica vazio
  // (FR-018: concentração obrigatória, sem default que mascare erro clínico).
  useEffect(() => {
    if (!needsDensity || protocolData.units_per_ml) return
    if (inheritedDensity) updateProtocol('units_per_ml', String(inheritedDensity))
    else if (defaultDensity) updateProtocol('units_per_ml', String(defaultDensity))
  }, [needsDensity, protocolData.units_per_ml, inheritedDensity, defaultDensity, updateProtocol])

  const handleWeekdayToggle = (day) => {
    const currentWeekdays = protocolData.weekdays || []
    const isSelected = currentWeekdays.includes(day)
    const next = isSelected
      ? currentWeekdays.filter((d) => d !== day)
      : [...currentWeekdays, day]

    updateProtocol('weekdays', next)
  }

  return (
    <div className="wizard__step">
      <h3 className="wizard__title">Como Tomar</h3>

      <StepFrequencySelector
        protocolData={protocolData}
        updateProtocol={updateProtocol}
        handleWeekdayToggle={handleWeekdayToggle}
      />

      <StepTimeScheduleSelector
        protocolData={protocolData}
        updateTime={updateTime}
        removeTime={removeTime}
        addTime={addTime}
      />

      <StepDosageSelector
        protocolData={protocolData}
        updateProtocol={updateProtocol}
        isLiquid={isLiquid}
        defaultIntake={defaultIntake}
        intakeOptions={intakeOptions}
        askDensity={askDensity}
        densityLabel={densityLabel}
        densityHint={densityHint}
        defaultDensity={defaultDensity}
        medicine={medicine}
      />

      <label className="wizard__label">
        Data de início
        <input
          type="date"
          className="wizard__input"
          value={protocolData.start_date}
          onChange={(e) => updateProtocol('start_date', e.target.value)}
        />
      </label>

      <PlanSelector
        availablePlans={availablePlans}
        planMode={planMode}
        setPlanMode={setPlanMode}
        selectedPlanId={selectedPlanId}
        setSelectedPlanId={setSelectedPlanId}
        newPlanName={newPlanName}
        setNewPlanName={setNewPlanName}
        newPlanEmoji={newPlanEmoji}
        setNewPlanEmoji={setNewPlanEmoji}
      />

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
        {/* Spec 044 F3: sem etapa de estoque (Step3), "Próximo" conclui direto. `skipStock`
            segue false — é ele que autoriza a criação do TRATAMENTO no passo 2; quem barra o
            estoque é o `stockTrackingEnabled` propagado até resolveStock. */}
        <Button
          variant="primary"
          onClick={() => (stockTrackingEnabled ? goNext() : handleComplete(false))}
          disabled={!isProtocolValid}
        >
          {stockTrackingEnabled ? 'Próximo →' : 'Concluir'}
        </Button>
      </div>
    </div>
  )
}
