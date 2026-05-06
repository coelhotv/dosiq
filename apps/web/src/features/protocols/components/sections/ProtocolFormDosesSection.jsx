import ShakeEffect from '@shared/components/ui/animations/ShakeEffect'
import Button from '@shared/components/ui/Button'
import { FREQUENCIES, FREQUENCY_LABELS } from '@schemas/protocolSchema'
import { getFieldDescribedBy } from '@utils/formUtils'

export default function ProtocolFormDosesSection({
  formData,
  handleChange,
  shakeFields,
  errors,
  timeInput,
  setTimeInput,
  addTime,
  removeTime,
}) {
  return (
    <>
      <div className="form-row">
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
              aria-describedby={getFieldDescribedBy('frequency')}
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

        <div className="form-group">
          <label htmlFor="dosage_per_intake">
            Dose por Horário (qtd) <span className="required">*</span>
          </label>
          <ShakeEffect trigger={shakeFields.dosage_per_intake}>
            <input
              type="number"
              id="dosage_per_intake"
              name="dosage_per_intake"
              value={formData.dosage_per_intake}
              onChange={handleChange}
              className={errors.dosage_per_intake ? 'error' : ''}
              placeholder="1"
              min="0.1"
              step="0.1"
              aria-describedby={getFieldDescribedBy('dosage_per_intake')}
              aria-invalid={Boolean(errors.dosage_per_intake)}
            />
          </ShakeEffect>
          {errors.dosage_per_intake && (
            <span id="dosage_per_intake-error" className="error-message">
              {errors.dosage_per_intake}
            </span>
          )}
        </div>
      </div>

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
              aria-describedby={getFieldDescribedBy('time_schedule')}
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
    </>
  )
}
