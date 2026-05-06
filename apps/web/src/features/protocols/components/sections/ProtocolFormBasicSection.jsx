import ShakeEffect from '@shared/components/ui/animations/ShakeEffect'
import { getFieldDescribedBy } from '@utils/formUtils'

export default function ProtocolFormBasicSection({
  formData,
  handleChange,
  shakeFields,
  errors,
  isSimpleMode,
  medicines,
  treatmentPlans,
  protocol,
  showTreatmentPlan,
}) {
  return (
    <>
      {!isSimpleMode && (
        <div className="form-group">
          <label htmlFor="medicine_id">
            Medicamento <span className="required">*</span>
          </label>
          <ShakeEffect trigger={shakeFields.medicine_id}>
            <select
              id="medicine_id"
              name="medicine_id"
              value={formData.medicine_id}
              onChange={handleChange}
              className={errors.medicine_id ? 'error' : ''}
              disabled={!!protocol} // Não permite mudar medicamento ao editar
              aria-describedby={getFieldDescribedBy('medicine_id')}
              aria-invalid={Boolean(errors.medicine_id)}
            >
              <option value="">Selecione um medicamento</option>
              {medicines.map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.name}{' '}
                  {medicine.dosage_per_pill
                    ? `(${medicine.dosage_per_pill}${medicine.dosage_unit || 'mg'})`
                    : `(${medicine.type === 'suplemento' ? 'Sup.' : 'N/A'})`}
                </option>
              ))}
            </select>
          </ShakeEffect>
          {errors.medicine_id && (
            <span id="medicine_id-error" className="error-message">
              {errors.medicine_id}
            </span>
          )}
        </div>
      )}

      {isSimpleMode && formData.medicine_id && (
        <input type="hidden" name="medicine_id" value={formData.medicine_id} />
      )}

      {!isSimpleMode && showTreatmentPlan && (
        <div className="form-group">
          <label htmlFor="treatment_plan_id">Plano de Tratamento (Opcional)</label>
          <select
            id="treatment_plan_id"
            name="treatment_plan_id"
            value={formData.treatment_plan_id}
            onChange={handleChange}
          >
            <option value="">Nenhum (Tratamento isolado)</option>
            {treatmentPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          <small style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
            Agrupe este remédio em um plano maior (ex: Quarteto Fantástico).
          </small>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="name">
          Nome do Tratamento <span className="required">*</span>
        </label>
        <ShakeEffect trigger={shakeFields.name}>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={errors.name ? 'error' : ''}
            placeholder="Ex: Paracetamol para dor"
            autoFocus={!protocol}
            aria-describedby={getFieldDescribedBy('name')}
            aria-invalid={Boolean(errors.name)}
          />
        </ShakeEffect>
        {errors.name && (
          <span id="name-error" className="error-message">
            {errors.name}
          </span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="start_date">
            Data de Início <span className="required">*</span>
          </label>
          <input
            type="date"
            id="start_date"
            name="start_date"
            value={formData.start_date}
            onChange={handleChange}
            required
            aria-describedby="start_date-hint"
          />
          <small id="start_date-hint">Quando você começou este tratamento</small>
        </div>

        <div className="form-group">
          <label htmlFor="end_date">Data de Término (opcional)</label>
          <input
            type="date"
            id="end_date"
            name="end_date"
            value={formData.end_date || ''}
            onChange={handleChange}
            min={formData.start_date}
          />
          <small>Deixe em branco para tratamento contínuo</small>
        </div>
      </div>
    </>
  )
}
