import { useState, useEffect } from 'react'
import Button from '@shared/components/ui/Button'
import ProtocolChecklistItem from '@protocols/components/ProtocolChecklistItem'
import './LogForm.css'

export default function LogForm({
  protocols,
  treatmentPlans = [],
  initialValues,
  onSave,
  onCancel,
}) {
  // Helper to format date to local ISO string (YYYY-MM-DDTHH:mm) for datetime-local input
  const toLocalISO = (dateStr) => {
    const date = dateStr ? new Date(dateStr) : new Date()
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
  }

  const [formData, setFormData] = useState({
    type:
      initialValues?.type ||
      (initialValues?.protocol_id
        ? 'protocol'
        : initialValues?.treatment_plan_id
          ? 'plan'
          : 'protocol'),
    id: initialValues?.id || null, // For editing
    protocol_id: initialValues?.protocol_id || '',
    treatment_plan_id: initialValues?.treatment_plan_id || '',
    taken_at: toLocalISO(initialValues?.taken_at),
    quantity_taken: initialValues?.quantity_taken || '',
    notes: initialValues?.notes || '',
  })

  const [selectedPlanProtocols, setSelectedPlanProtocols] = useState([])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedProtocol = protocols.find((p) => p.id === formData.protocol_id)
  const selectedPlan = treatmentPlans.find((p) => p.id === formData.treatment_plan_id)

  // Atualizar formData quando initialValues mudar (Deep Linking Interno)
  useEffect(() => {
    if (initialValues) {
      setFormData((prev) => ({
        ...prev,
        type:
          initialValues.type ||
          (initialValues.protocol_id
            ? 'protocol'
            : initialValues.treatment_plan_id
              ? 'plan'
              : 'protocol'),
        protocol_id: initialValues.protocol_id || '',
        treatment_plan_id: initialValues.treatment_plan_id || '',
        taken_at: toLocalISO(initialValues.taken_at),
        quantity_taken: initialValues.quantity_taken || '',
        notes: initialValues.notes || '',
      }))
    }
  }, [initialValues])

  // Auto-select all protocols when a plan is selected
  useEffect(() => {
    if (formData.type === 'plan' && formData.treatment_plan_id) {
      const plan = treatmentPlans.find((p) => p.id === formData.treatment_plan_id)
      if (plan) {
        const activeIds = plan.protocols?.filter((p) => p.active).map((p) => p.id) || []
        setSelectedPlanProtocols(activeIds)
      }
    } else {
      setSelectedPlanProtocols([])
    }
  }, [formData.treatment_plan_id, formData.type, treatmentPlans])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const toggleProtocol = (protocolId) => {
    setSelectedPlanProtocols((prev) => {
      if (prev.includes(protocolId)) {
        return prev.filter((id) => id !== protocolId)
      } else {
        return [...prev, protocolId]
      }
    })

    // Clear error if selection becomes valid
    if (errors.submit && selectedPlanProtocols.length === 0) {
      // logic inverted because state update is async, but simple check is enough
      setErrors((prev) => ({ ...prev, submit: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (formData.type === 'protocol' && !formData.protocol_id) {
      newErrors.protocol_id = 'Selecione um protocolo'
    }

    if (formData.type === 'plan') {
      if (!formData.treatment_plan_id) {
        newErrors.treatment_plan_id = 'Selecione um plano'
      } else if (selectedPlanProtocols.length === 0) {
        newErrors.submit = 'Selecione pelo menos um medicamento para registrar'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) return

    setIsSubmitting(true)

    try {
      if (formData.type === 'protocol') {
        const protocol = protocols.find((p) => p.id === formData.protocol_id)
        if (!protocol) {
          throw new Error('Protocolo não encontrado')
        }

        const dataToSave = {
          protocol_id: formData.protocol_id,
          medicine_id: protocol.medicine_id,
          quantity_taken: formData.quantity_taken
            ? parseFloat(formData.quantity_taken)
            : protocol.dosage_per_intake,
          taken_at: new Date(formData.taken_at).toISOString(),
          notes: formData.notes.trim() || null,
        }

        if (formData.id) {
          await onSave({ ...dataToSave, id: formData.id })
        } else {
          await onSave(dataToSave)
        }
      } else {
        // Plan bulk log
        const plan = treatmentPlans.find((p) => p.id === formData.treatment_plan_id)
        if (!plan) {
          throw new Error('Plano não encontrado')
        }

        // Filter only selected protocols
        const protocolsToLog =
          plan.protocols?.filter((p) => p.active && selectedPlanProtocols.includes(p.id)) || []

        if (protocolsToLog.length === 0) {
          throw new Error('Nenhum protocolo selecionado')
        }

        const logsToSave = protocolsToLog.map((p) => ({
          protocol_id: p.id,
          medicine_id: p.medicine_id,
          quantity_taken: p.dosage_per_intake,
          taken_at: new Date(formData.taken_at).toISOString(),
          notes: formData.notes.trim()
            ? `[Plano: ${plan.name}] ${formData.notes.trim()}`
            : `[Plano: ${plan.name}]`,
        }))

        await onSave(logsToSave)
      }
    } catch (error) {
      console.error('Erro ao registrar medicamento:', error)
      const errorMessage = error?.message || 'Erro desconhecido ao registrar medicamento'
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="log-form" onSubmit={handleSubmit}>
      <h3>Registrar Medicamento Tomado</h3>

      <div className="log-type-toggle">
        <button
          type="button"
          className={formData.type === 'protocol' ? 'active' : ''}
          onClick={() => setFormData((prev) => ({ ...prev, type: 'protocol' }))}
        >
          💊 Único Remédio
        </button>
        <button
          type="button"
          className={formData.type === 'plan' ? 'active' : ''}
          onClick={() => setFormData((prev) => ({ ...prev, type: 'plan' }))}
          disabled={treatmentPlans.length === 0 || formData.id}
        >
          📁 Plano Completo
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="taken_at">
          Data e Hora do Registro <span className="required">*</span>
        </label>
        <input
          type="datetime-local"
          id="taken_at"
          name="taken_at"
          value={formData.taken_at}
          onChange={handleChange}
          required
        />
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
            {treatmentPlans.map((plan) => (
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
              type="number"
              id="quantity_taken"
              name="quantity_taken"
              value={
                formData.quantity_taken ||
                (selectedProtocol ? selectedProtocol.dosage_per_intake : '')
              }
              onChange={handleChange}
              step="0.1"
              min="0.1"
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

      <div className="form-group">
        <label htmlFor="notes">Observações (opcional)</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Ex: Tomei com água, após café da manhã..."
          rows="3"
        />
      </div>

      {errors.submit && <div className="error-banner">❌ {errors.submit}</div>}

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={
            isSubmitting ||
            (formData.type === 'protocol'
              ? !formData.protocol_id
              : !formData.treatment_plan_id || selectedPlanProtocols.length === 0)
          }
        >
          {isSubmitting
            ? 'Salvando...'
            : formData.id
              ? '💾 Atualizar Registro'
              : formData.type === 'plan' && selectedPlanProtocols.length > 0
                ? `✅ Registrar (${selectedPlanProtocols.length})`
                : '✅ Registrar Dose'}
        </Button>
      </div>
    </form>
  )
}
