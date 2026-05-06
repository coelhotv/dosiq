import { Pill, Folders } from 'lucide-react'
import ProtocolChecklistItem from '@protocols/components/ProtocolChecklistItem'

export default function LogFormMedicineSection({
  formData,
  setFormData,
  protocols,
  treatmentPlans,
  errors,
  handleChange,
  selectedProtocol,
  selectedPlan,
  selectedPlanProtocols,
  toggleProtocol,
}) {
  return (
    <>
      <div className="log-type-toggle">
        <button
          type="button"
          className={formData.type === 'protocol' ? 'active' : ''}
          onClick={() => setFormData((prev) => ({ ...prev, type: 'protocol' }))}
        >
          <Pill size={18} /> Único Remédio
        </button>
        <button
          type="button"
          className={formData.type === 'plan' ? 'active' : ''}
          onClick={() => setFormData((prev) => ({ ...prev, type: 'plan' }))}
          disabled={!treatmentPlans || treatmentPlans.length === 0 || formData.id}
        >
          <Folders size={18} /> Plano Completo
        </button>
      </div>

      {formData.type === 'protocol' ? (
        <div className="form-group">
          <label htmlFor="protocol_id">
            Protocolo <span className="required">*</span>
          </label>
          <select
            id="protocol_id"
            name="protocol_id"
            value={formData.protocol_id}
            onChange={handleChange}
            className={errors.protocol_id ? 'error' : ''}
          >
            <option value="">Selecione um protocolo</option>
            {protocols.map((protocol) => (
              <option key={protocol.id} value={protocol.id}>
                {protocol.name} - {protocol.medicine?.name}
              </option>
            ))}
          </select>
          {errors.protocol_id && <span className="error-message">{errors.protocol_id}</span>}
        </div>
      ) : (
        <div className="form-group">
          <label htmlFor="treatment_plan_id">
            Plano de Tratamento <span className="required">*</span>
          </label>
          <select
            id="treatment_plan_id"
            name="treatment_plan_id"
            value={formData.treatment_plan_id}
            onChange={handleChange}
            className={errors.treatment_plan_id ? 'error' : ''}
          >
            <option value="">Selecione um plano</option>
            {treatmentPlans?.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({plan.protocols?.filter((p) => p.active).length || 0} remédios)
              </option>
            ))}
          </select>
          {errors.treatment_plan_id && (
            <span className="error-message">{errors.treatment_plan_id}</span>
          )}
        </div>
      )}

      {selectedProtocol && formData.type === 'protocol' && (
        <div className="protocol-info">
          <div className="form-group">
            <label htmlFor="quantity_taken">Quantidade Tomada</label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              id="quantity_taken"
              name="quantity_taken"
              value={
                formData.quantity_taken ||
                (selectedProtocol ? selectedProtocol.dosage_per_intake : '')
              }
              onChange={handleChange}
              required
            />
          </div>
          <div className="info-item" style={{ marginTop: 'var(--space-2)' }}>
            <span className="info-label">💊 Medicamento:</span>
            <span className="info-value">{selectedProtocol.medicine?.name}</span>
          </div>
        </div>
      )}

      {selectedPlan && formData.type === 'plan' && (
        <div className="protocol-info">
          <p className="plan-summary-title">Selecione os medicamentos tomados:</p>
          <div className="plan-medicines-list">
            {selectedPlan.protocols
              ?.filter((p) => p.active)
              .map((p) => (
                <ProtocolChecklistItem
                  key={p.id}
                  protocol={p}
                  isSelected={selectedPlanProtocols.includes(p.id)}
                  onToggle={toggleProtocol}
                />
              ))}
          </div>
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              textAlign: 'right',
            }}
          >
            {selectedPlanProtocols.length} selecionados
          </div>
        </div>
      )}
    </>
  )
}
