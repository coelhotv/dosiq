import { useEffect } from 'react'
import ShakeEffect from '@shared/components/ui/animations/ShakeEffect'
import Button from '@shared/components/ui/Button'
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  INTAKE_UNITS,
  INTAKE_UNIT_LABELS,
} from '@schemas/protocolSchema'
import { getFieldDescribedBy } from '@utils/formUtils'
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

function FrequencySelector({ formData, handleChange, shakeFields, errors }) {
  return (
    <div className="form-group">
      <label htmlFor="frequency">
        Frequência <span className="required">*</span>
      </label>
      <ShakeEffect trigger={shakeFields.frequency}>
        <select
          id="frequency"
          name="frequency"
          value={formData.frequency}
          onChange={handleChange}
          className={errors.frequency ? 'error' : ''}
          aria-describedby={getFieldDescribedBy('frequency', errors)}
          aria-invalid={Boolean(errors.frequency)}
        >
          <option value="">Selecione a frequência</option>
          {FREQUENCIES.map((freq) => (
            <option key={freq} value={freq}>
              {FREQUENCY_LABELS[freq]}
            </option>
          ))}
        </select>
      </ShakeEffect>
      {errors.frequency && (
        <span id="frequency-error" className="error-message">
          {errors.frequency}
        </span>
      )}
    </div>
  )
}

function DosagePerIntakeInput({
  formData,
  handleChange,
  shakeFields,
  errors,
  medicine,
  isLiquid,
  defaultIntake,
  needsDensity,
  densityLabel,
  densityHint,
  defaultDensity,
}) {
  return (
    <div className="form-group">
      <label htmlFor="dosage_per_intake">
        Dose por Horário (qtd) <span className="required">*</span>
      </label>
      <ShakeEffect trigger={shakeFields.dosage_per_intake}>
        {/* type=text + inputMode=decimal: aceita vírgula PT-BR ("2,5"); number
            bloquearia a vírgula no browser. Normalização vírgula→ponto no submit
            (parseDecimalPtBr — R-270/AP-167). */}
        <input
          type="text"
          inputMode="decimal"
          id="dosage_per_intake"
          name="dosage_per_intake"
          value={formData.dosage_per_intake}
          onChange={handleChange}
          className={errors.dosage_per_intake ? 'error' : ''}
          placeholder="1"
          aria-describedby={getFieldDescribedBy('dosage_per_intake', errors)}
          aria-invalid={Boolean(errors.dosage_per_intake)}
        />
      </ShakeEffect>
      {medicine && (
        <span className="helper-text active-ingredient-hint" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          ✨ {formatDoseHint(formData.dosage_per_intake, formData.intake_unit, medicine)}
        </span>
      )}
      {isLiquid && (
        <select
          name="intake_unit"
          value={formData.intake_unit || defaultIntake}
          onChange={handleChange}
          className="intake-unit-select"
          aria-label="Unidade de tomada"
          style={{ marginTop: '6px' }}
        >
          {INTAKE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {INTAKE_UNIT_LABELS[unit] || unit}
            </option>
          ))}
        </select>
      )}
      {needsDensity && (
        <div style={{ marginTop: '8px' }}>
          <label htmlFor="units_per_ml" style={{ fontSize: '13px' }}>
            {densityLabel}
          </label>
          <input
            type="text"
            inputMode="decimal"
            id="units_per_ml"
            name="units_per_ml"
            value={formData.units_per_ml}
            onChange={handleChange}
            placeholder={String(defaultDensity)}
          />
          <small className="field-hint" style={{ display: 'block' }}>
            {densityHint}.
          </small>
        </div>
      )}
      {errors.dosage_per_intake && (
        <span id="dosage_per_intake-error" className="error-message">
          {errors.dosage_per_intake}
        </span>
      )}
    </div>
  )
}

function WeekdaySelector({ formData, handleChange, shakeFields, errors }) {
  const handleWeekdayToggle = (day) => {
    const currentWeekdays = formData.weekdays || []
    const isSelected = currentWeekdays.includes(day)
    const next = isSelected
      ? currentWeekdays.filter((d) => d !== day)
      : [...currentWeekdays, day]

    handleChange({
      target: {
        name: 'weekdays',
        value: next,
      },
    })
  }

  if (!REQUIRES_WEEKDAYS.has(formData.frequency)) return null

  return (
    <div className="form-group">
      <label>
        Dias da Semana <span className="required">*</span>
      </label>
      <ShakeEffect trigger={shakeFields.weekdays}>
        <div className="weekday-selector-pwa">
          {VISUAL_ORDER.map(({ key, label }) => {
            const isSelected = (formData.weekdays || []).includes(key)
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
      </ShakeEffect>
      {errors.weekdays && (
        <span id="weekdays-error" className="error-message">
          {errors.weekdays}
        </span>
      )}
    </div>
  )
}

function TimeScheduleInput({
  formData,
  shakeFields,
  errors,
  timeInput,
  setTimeInput,
  addTime,
  removeTime,
}) {
  return (
    <div className="form-group">
      <label htmlFor="time_input">
        Horários <span className="required">*</span>
      </label>
      <ShakeEffect trigger={shakeFields.time_schedule}>
        <div className="time-input-group">
          <input
            type="time"
            id="time_input"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className={errors.time_schedule ? 'error' : ''}
            aria-describedby={getFieldDescribedBy('time_schedule', errors)}
            aria-invalid={Boolean(errors.time_schedule)}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTime}>
            ➕ Adicionar
          </Button>
        </div>
      </ShakeEffect>
      {errors.time_schedule && (
        <span id="time_schedule-error" className="error-message">
          {errors.time_schedule}
        </span>
      )}

      {formData.time_schedule.length > 0 && (
        <div className="time-schedule-list">
          {formData.time_schedule.map((time) => (
            <div key={time} className="time-chip">
              <span>{time}</span>
              <button type="button" onClick={() => removeTime(time)} className="remove-time">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProtocolFormDosesSection({
  formData,
  handleChange,
  shakeFields,
  errors,
  timeInput,
  setTimeInput,
  addTime,
  removeTime,
  medicine,
}) {
  // Líquido := dosage_unit do medicamento termina em '/ml' (decisão-mãe 022).
  const isLiquid = Boolean(medicine?.dosage_unit?.endsWith('/ml'))
  // ui/ml (insulina) → UI; demais líquidos (mg/ml xarope) → ml por padrão.
  const defaultIntake = medicine?.dosage_unit === 'ui/ml' ? 'UI' : 'ml'
  // Densidade só é relevante p/ gotas/UI (razão física sub-ml). mg usa a concentração
  // do medicamento (dosage_per_pill), NÃO units_per_ml → não pede densidade (smoke PO
  // 2026-06-12); ml é dose direta.
  const needsDensity =
    isLiquid && formData.intake_unit && formData.intake_unit !== 'ml' && formData.intake_unit !== 'mg'
  const densityLabel = formData.intake_unit === 'UI' ? 'UI por ml' : 'Gotas por ml'
  const densityHint =
    formData.intake_unit === 'UI' ? 'Geralmente 100 UI por mL' : 'Geralmente 20 gotas por mL'
  const defaultDensity = formData.intake_unit === 'UI' ? 100 : 20

  // Garante intake_unit preenchido p/ líquidos (evita null silencioso no debito).
  useEffect(() => {
    if (isLiquid && !formData.intake_unit) {
      handleChange({ target: { name: 'intake_unit', value: defaultIntake } })
    }
  }, [isLiquid, formData.intake_unit, defaultIntake, handleChange])

  // Prefill densidade padrão quando passa a precisar (gotas/UI) e está vazia.
  useEffect(() => {
    if (needsDensity && !formData.units_per_ml) {
      handleChange({ target: { name: 'units_per_ml', value: String(defaultDensity) } })
    }
  }, [needsDensity, formData.units_per_ml, defaultDensity, handleChange])

  return (
    <>
      <div className="form-row">
        <FrequencySelector
          formData={formData}
          handleChange={handleChange}
          shakeFields={shakeFields}
          errors={errors}
        />

        <DosagePerIntakeInput
          formData={formData}
          handleChange={handleChange}
          shakeFields={shakeFields}
          errors={errors}
          medicine={medicine}
          isLiquid={isLiquid}
          defaultIntake={defaultIntake}
          needsDensity={needsDensity}
          densityLabel={densityLabel}
          densityHint={densityHint}
          defaultDensity={defaultDensity}
        />
      </div>

      <WeekdaySelector
        formData={formData}
        handleChange={handleChange}
        shakeFields={shakeFields}
        errors={errors}
      />

      <TimeScheduleInput
        formData={formData}
        shakeFields={shakeFields}
        errors={errors}
        timeInput={timeInput}
        setTimeInput={setTimeInput}
        addTime={addTime}
        removeTime={removeTime}
      />
    </>
  )
}

