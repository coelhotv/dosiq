/**
 * EmergencyFormBottom — Seções de tipo sanguíneo, observações e ações do EmergencyCardForm.
 */
import Button from '@shared/components/ui/Button'
import Card from '@shared/components/ui/Card'
import { BLOOD_TYPES, BLOOD_TYPE_LABELS } from '@schemas/emergencyCardSchema'
import { Droplets, FilePen } from 'lucide-react'

export default function EmergencyFormBottom({
  bloodType,
  setBloodType,
  notes,
  setNotes,
  submitMessage,
  formattedErrors,
  isSubmitting,
  onCancel,
}) {
  return (
    <>
      <Card className="emergency-card-section" hover={false}>
        <h3 className="section-title"><Droplets size={22} /> Tipo Sanguíneo</h3>
        <p className="section-description">Selecione seu tipo sanguíneo. Isso pode ser vital em uma emergência.</p>
        <div className="form-group">
          <label htmlFor="blood-type">Tipo Sanguíneo</label>
          <select id="blood-type" value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="blood-type-select">
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type}>{BLOOD_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="emergency-card-section" hover={false}>
        <h3 className="section-title"><FilePen size={22} /> Observações</h3>
        <p className="section-description">Informações adicionais importantes (condições médicas, medicamentos em uso contínuo, etc.).</p>
        <div className="form-group">
          <label htmlFor="notes">Observações</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Portador de marcapasso, usa anticoagulante..."
            maxLength={1000}
            rows={4}
            className="notes-textarea"
          />
          <span className="char-count">{notes.length}/1000</span>
        </div>
      </Card>

      {submitMessage && (
        <div className={`submit-message submit-message-${submitMessage.type}`}>{submitMessage.text}</div>
      )}
      {formattedErrors && Object.keys(formattedErrors).length > 0 && !submitMessage && (
        <div className="submit-message submit-message-error">Verifique os campos destacados no formulário.</div>
      )}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Salvar Cartão'}
        </Button>
      </div>
    </>
  )
}
